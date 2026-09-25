"""FastAPI service. Interactive docs at http://localhost:8000/docs

Access control (RBAC). Set QSENTINEL_API_KEYS to enable it:
    QSENTINEL_API_KEYS="k1=alice:signer,k2=bob:verifier,k3=soc:analyst,k4=root:admin"
Clients send the key in the `X-API-Key` header (WebSocket: `?key=`). Identity comes from the
key, NOT from the request body: a signer can only sign as itself, and a verifier can only
verify as itself. That stops impersonation and unauthorised verification at the perimeter,
before D6 even runs. Without QSENTINEL_API_KEYS the API runs in open DEV MODE (as admin).

Roles: signer (sign) | verifier (verify) | analyst (read ledger/telemetry/links/verdicts) |
       redteam (run attacks and sweeps) | admin (everything)

The dashboard (web/) and the advisory ops service (ops/) only use the endpoints below; see
docs/frontend-spec.md section 10 for the contract.
TODO(security-lead): OAuth 2.1 / mTLS in front for production; keys in Vault, not env vars.
"""

from __future__ import annotations

import asyncio
import hmac
import os
from dataclasses import dataclass

import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ..attacks import ATTACKS, run_attack
from ..attacks.sweep import sweep
from ..config import FAST, Settings
from ..detect.calibrate import tradeoff_table
from ..ledger import audit, find_disputes
from ..pipeline import QSentinel
from ..qds import Signature
from ..quantum import ChannelModel

PROFILE = os.getenv("QSENTINEL_PROFILE", "fast")
SETTINGS = FAST if PROFILE == "fast" else Settings()
env = QSentinel(settings=SETTINGS)
env.register_signer("alice")
env.register_verifier("bob")
env.register_verifier("charlie")

DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
app = FastAPI(title="Q-SENTINEL API", version="0.3.0",
              description="AI-free quantum threat detection for teleportation-based QDS")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", DEFAULT_ORIGINS).split(","),
                   allow_methods=["*"], allow_headers=["*"])


# --- auth ----------------------------------------------------------------------------------
@dataclass(frozen=True)
class Principal:
    name: str
    roles: frozenset[str]
    dev: bool = False


def _key_table() -> dict[str, Principal]:
    raw = os.getenv("QSENTINEL_API_KEYS", "").strip()
    table = {}
    for item in filter(None, (x.strip() for x in raw.split(","))):
        key, _, who = item.partition("=")
        name, _, roles = who.partition(":")
        table[key] = Principal(name, frozenset(roles.split("+")))
    return table


def _lookup(key: str | None) -> Principal:
    table = _key_table()
    if not table:
        return Principal("dev", frozenset({"admin"}), dev=True)
    for k, p in table.items():
        if key is not None and hmac.compare_digest(k, key):
            return p
    raise HTTPException(401, "missing or invalid X-API-Key")


def principal(x_api_key: str | None = Header(None)) -> Principal:
    return _lookup(x_api_key)


def require(*roles: str):
    def dep(p: Principal = Depends(principal)) -> Principal:
        if "admin" in p.roles or p.roles & set(roles):
            return p
        raise HTTPException(403, f"role {'/'.join(roles)} required")
    return dep


def _acting_as(p: Principal, requested: str) -> str:
    """Admins/dev may act for anyone; everyone else acts only as themselves."""
    if "admin" in p.roles:
        return requested
    if requested != p.name:
        raise HTTPException(403, f"authenticated as {p.name!r}, cannot act as {requested!r}")
    return p.name


# --- models --------------------------------------------------------------------------------
class ChannelIn(BaseModel):
    depolarizing: float = Field(0.0, ge=0, le=0.75)
    intercept_fraction: float = Field(0.0, ge=0, le=1)
    eve_bases: list[int] = Field(default_factory=lambda: [0, 1, 2], min_length=1, max_length=3)
    entangle_fraction: float = Field(0.0, ge=0, le=1)
    entangle_basis: int = Field(0, ge=0, le=2)

    def model(self) -> ChannelModel:
        if any(b not in (0, 1, 2) for b in self.eve_bases):
            raise HTTPException(422, "eve_bases must be a subset of [0, 1, 2] (Z, X, Y)")
        return ChannelModel(self.depolarizing, self.intercept_fraction, tuple(sorted(set(self.eve_bases))),
                            self.entangle_fraction, self.entangle_basis)


class SignIn(BaseModel):
    signer_id: str = "alice"
    message: str


class VerifyIn(BaseModel):
    signature: dict
    verifier_id: str = "bob"
    transferred: bool = False
    channel: ChannelIn = ChannelIn()


class AttackIn(BaseModel):
    attack: str
    strength: float | None = Field(None, ge=0, le=1)
    seed: int | None = None
    channel: ChannelIn = ChannelIn()


class SweepIn(BaseModel):
    attack: str
    min: float = Field(0.0, ge=0, le=1)
    max: float = Field(1.0, ge=0, le=1)
    steps: int = Field(6, ge=2, le=11)
    trials: int = Field(4, ge=1, le=10)
    noise: float = Field(0.0, ge=0, le=0.2)
    full: bool = False
    seed: int = 0


# --- status --------------------------------------------------------------------------------
@app.get("/health")
def health():
    p = SETTINGS.protocol
    from ..pqc import kem
    return {"status": "ok", "profile": PROFILE, "backend": env.backend.name, "basis_set": p.basis_set,
            "hash_bits": p.hash_bits, "rounds_per_bit": p.rounds_per_bit, "tau": p.tau,
            "tau_transfer": p.tau_transfer, "symmetrise": p.symmetrise,
            "pqc": env.ledger.signer.implementation, "kem": kem.implementation(),
            "auth": "dev-open" if not _key_table() else "api-keys",
            "telemetry_mirror": "redis" if env.telemetry.mirror_enabled else "off",
            "verdicts": len(env._verdicts), "ledger_entries": len(env.ledger.entries)}


def _link_status(point: dict | None) -> str:
    if point is None:
        return "idle"
    d = SETTINGS.detectors
    if (point["chsh"] is not None and point["chsh"] <= d.chsh_min) or point["qber"] > d.qber_max:
        return "critical"
    if point["fingerprint_drift"] or point["cusum_alarm"]:
        return "warning"
    return "healthy"


@app.get("/overview", dependencies=[Depends(require("analyst"))])
def overview():
    """Everything Mission Control needs in one call."""
    with env._lock:
        verdicts = list(env._verdicts.values())
        ok, detail = env.ledger.verify_chain()
        anchors = env.ledger.by_kind("merkle_anchor")
        disputes = find_disputes(env.ledger)
        links = {name: _link_status((env.link_history(name) or [None])[-1]) for name in env.monitor.links}
    sev = [r["severity"] for v in verdicts for r in v["results"] if r["alert"]]
    return {
        "verdicts": {"total": len(verdicts), "accept": sum(v["decision"] == "ACCEPT" for v in verdicts),
                     "reject": sum(v["decision"] == "REJECT" for v in verdicts)},
        "alerts": {"critical": sev.count("critical"), "warning": sev.count("warning")},
        "links": links,
        "ledger": {"entries": len(env.ledger.entries), "chain_ok": ok, "detail": detail,
                   "anchors": len(anchors), "last_anchor_index": anchors[-1].index if anchors else None,
                   "unanchored": len(env.ledger.unanchored_verdicts())},
        "disputes": len(disputes),
    }


@app.get("/participants", dependencies=[Depends(require("analyst"))])
def participants():
    return {"signers": sorted(env.signers), "verifiers": sorted(env.identities.authorised_verifiers),
            "honeypots": len(env.identities.honeypots)}


# --- enrolment -----------------------------------------------------------------------------
@app.post("/signers/{signer_id}", dependencies=[Depends(require("admin"))])
def add_signer(signer_id: str):
    env.register_signer(signer_id)
    return {"ok": True}


@app.post("/verifiers/{verifier_id}", dependencies=[Depends(require("admin"))])
def add_verifier(verifier_id: str):
    env.register_verifier(verifier_id)
    return {"ok": True}


@app.post("/honeypots/{signer_id}", dependencies=[Depends(require("admin"))])
def add_honeypot(signer_id: str):
    try:
        return {"key_id": env.issue_honeypot(signer_id)}
    except PermissionError as e:
        raise HTTPException(404, str(e)) from e


# --- sign / verify -------------------------------------------------------------------------
@app.post("/sign")
def sign(body: SignIn, p: Principal = Depends(require("signer"))):
    signer = _acting_as(p, body.signer_id)
    try:
        sig = env.sign(signer, body.message.encode())
    except PermissionError as e:
        raise HTTPException(403, str(e)) from e
    return sig.to_dict()


@app.post("/verify")
def verify(body: VerifyIn, p: Principal = Depends(require("verifier"))):
    verifier = _acting_as(p, body.verifier_id)
    try:
        sig = Signature.from_dict(body.signature)
    except (KeyError, ValueError, TypeError) as e:
        raise HTTPException(422, f"malformed signature: {e}") from e
    try:
        verdict = env.verify(sig, verifier, body.channel.model(), transferred=body.transferred)
    except KeyError as e:
        raise HTTPException(404, str(e)) from e
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    return verdict.to_dict()


@app.get("/verdicts", dependencies=[Depends(require("analyst"))])
def verdicts(limit: int = Query(50, ge=1, le=500)):
    return env.recent_verdicts(limit)


@app.get("/verdicts/{ledger_index}", dependencies=[Depends(require("analyst"))])
def verdict(ledger_index: int):
    v = env.verdict(ledger_index)
    if v is None:
        raise HTTPException(404, "no verdict stored at that ledger index")
    return v


# --- red team ------------------------------------------------------------------------------
@app.get("/attacks")
def list_attacks():
    return [{"name": k, "expected": v.expected, "detectors": v.detectors,
             "default_strength": v.default_strength,
             "description": (v.fn.__doc__ or "").strip().split("\n")[0]}
            for k, v in ATTACKS.items()]


@app.post("/attacks/run", dependencies=[Depends(require("redteam"))])
def attack(body: AttackIn):
    if body.attack not in ATTACKS:
        raise HTTPException(404, f"unknown attack {body.attack}")
    try:
        rep = run_attack(env, body.attack, body.strength,
                         seed=body.seed if body.seed is not None else int.from_bytes(os.urandom(4)),
                         channel=body.channel.model())
    except NotImplementedError as e:
        raise HTTPException(501, f"{body.attack} not implemented yet") from e
    return {**rep.row(), "metrics": rep.metrics, "verdict": rep.verdict}


@app.post("/sweeps", dependencies=[Depends(require("redteam"))])
def run_sweep(body: SweepIn):
    """Detection rate vs strength, on a separate throw-away system (never the live ledger)."""
    if body.attack not in ATTACKS:
        raise HTTPException(404, f"unknown attack {body.attack}")
    if body.full and body.steps * body.trials > 30:
        raise HTTPException(422, "full-size sweeps are limited to steps x trials <= 30")
    lo, hi = sorted((body.min, body.max))
    return sweep(body.attack, np.linspace(lo, hi, body.steps), body.trials,
                 Settings() if body.full else FAST, body.noise, body.seed)


# --- ledger --------------------------------------------------------------------------------
@app.get("/ledger", dependencies=[Depends(require("analyst"))])
def ledger(limit: int = Query(50, ge=1, le=1000), kind: str | None = None):
    entries = env.ledger.by_kind(kind) if kind else env.ledger.entries
    return [e.__dict__ for e in entries[-limit:]]


@app.get("/ledger/verify", dependencies=[Depends(require("analyst"))])
def ledger_verify():
    ok, msg = env.ledger.verify_chain()
    return {"ok": ok, "detail": msg}


@app.get("/ledger/audit", dependencies=[Depends(require("analyst"))])
def ledger_audit():
    return audit(env.ledger)


@app.post("/ledger/anchor", dependencies=[Depends(require("admin"))])
def ledger_anchor():
    e = env.ledger.anchor(force=True)
    return {"anchored": e is not None, "entry": e.__dict__ if e else None}


@app.get("/ledger/proof/{index}")
def ledger_proof(index: int):
    """Public: a Merkle inclusion proof reveals only hashes."""
    proof = env.ledger.inclusion_proof(index)
    if proof is None:
        raise HTTPException(404, "not a verdict, or not anchored yet (POST /ledger/anchor)")
    return {**proof, "valid": env.ledger.check_proof(proof)}


# --- channels, calibration, telemetry ------------------------------------------------------
@app.get("/links", dependencies=[Depends(require("analyst"))])
def links(history: int = Query(100, ge=0, le=200)):
    status = env.monitor.status()
    for name, s in status.items():
        h = env.link_history(name)
        s["latest"] = h[-1] if h else None
        s["status"] = _link_status(s["latest"])
        s["history"] = h[-history:] if history else []
    return status


@app.get("/calibration")
def calibration(target: float = 1e-16):
    return tradeoff_table(target)


@app.get("/telemetry", dependencies=[Depends(require("analyst"))])
def telemetry(since: int = 0):
    return env.telemetry.read(since)


@app.websocket("/ws/telemetry")
async def ws_telemetry(ws: WebSocket, key: str | None = Query(None)):
    try:
        p = _lookup(key)
    except HTTPException:
        await ws.close(code=4401)
        return
    if not ({"admin", "analyst"} & p.roles):
        await ws.close(code=4403)
        return
    await ws.accept()
    last = int(ws.query_params.get("since", 0))
    try:
        while True:
            for event in env.telemetry.read(last):
                await ws.send_json(event)
                last = event["seq"]
            await asyncio.sleep(0.25)
    except WebSocketDisconnect:
        return
