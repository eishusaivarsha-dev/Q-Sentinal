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
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Literal

import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .. import acceptance
from ..attacks import ATTACKS, run_attack
from ..attacks.sweep import sweep
from ..config import FAST, Settings
from ..detect.calibrate import tradeoff_table
from ..detect.validate import false_alarm_validation
from ..ledger import audit, find_disputes
from ..pipeline import QSentinel
from ..qds import Signature
from ..quantum import ChannelModel
from ..quantum import statevector as sv

PROFILE = os.getenv("QSENTINEL_PROFILE", "fast")
SETTINGS = FAST if PROFILE == "fast" else Settings()
env = QSentinel(settings=SETTINGS)
env.register_signer("alice")
env.register_verifier("bob")
env.register_verifier("charlie")

DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"


def seed_demo() -> None:
    """QSENTINEL_DEMO_SEED=1 (the public demo image): start with a short, realistic history so the
    console is not empty for the first visitor - honest traffic on two links, a few attacks, and
    one Merkle anchor. Everything goes through the normal pipeline and ledger."""
    for i in range(4):
        for verifier in ("bob", "charlie"):
            env.verify(env.sign("alice", f"Settlement batch #{1040 + i}".encode()), verifier)
    for attack, strength in (("stealth_probe", None), ("blind_forgery", None), ("replay", None),
                             ("intercept_resend", 0.5), ("stolen_key_honeypot", None)):
        run_attack(env, attack, strength, seed=int.from_bytes(os.urandom(4)))
        env.verify(env.sign("alice", b"Routine clearance"), "bob")
    env.ledger.anchor(force=True)


@asynccontextmanager
async def lifespan(_app):
    if os.getenv("QSENTINEL_DEMO_SEED") == "1" and not env.ledger.entries[1:]:
        await asyncio.to_thread(seed_demo)
    yield


app = FastAPI(title="Q-SENTINEL API", version="0.4.0", lifespan=lifespan,
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


class TeleportIn(BaseModel):
    state: str | None = Field(None, description="one of 0, 1, +, -, +i, -i; or null to use theta/phi")
    theta: float = Field(0.0, ge=0, le=3.1416)
    phi: float = Field(0.0, ge=-6.2832, le=6.2832)
    channel: ChannelIn = ChannelIn()
    seed: int | None = None


class BsmIn(BaseModel):
    shots: int = Field(4096, ge=16, le=1_000_000)
    channel: ChannelIn = ChannelIn()
    seed: int | None = None


class AdvisorySnapshot(BaseModel):
    """What the advisory AI recommended when the analyst decided (stored for the audit trail only)."""
    risk: int = Field(..., ge=0, le=100)
    level: str = Field(..., max_length=16)
    category: str = Field(..., max_length=80)
    recommendation: Literal["confirm_fraud", "escalate", "monitor", "dismiss"]


class ReviewIn(BaseModel):
    decision: Literal["confirm_fraud", "escalate", "monitor", "dismiss"]
    note: str = Field("", max_length=600)
    reviewer: str = Field("analyst", min_length=1, max_length=40)
    advisory: AdvisorySnapshot | None = None


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


# --- analyst fraud reviews (the human's decision, on the ledger) ----------------------------
# The advisory AI (ops/) scores cases and recommends a disposition; the analyst decides. The
# decision is chained and ML-DSA signed like a verdict, so it is non-repudiable. It never changes
# the verdict itself: ACCEPT/REJECT stays the detectors' call.
ADVISORY_LABEL = "ADVISORY - NOT A TRUST DECISION"


def _reviews() -> list[dict]:
    return [{"index": e.index, "timestamp": e.timestamp, "entry_hash": e.entry_hash, **e.payload}
            for e in env.ledger.by_kind("analyst_review")]


@app.post("/reviews/{ledger_index}")
def add_review(ledger_index: int, body: ReviewIn, p: Principal = Depends(require("analyst"))):
    v = env.verdict(ledger_index)
    if v is None:
        raise HTTPException(404, "no verdict stored at that ledger index")
    reviewer = body.reviewer if p.dev or "admin" in p.roles else p.name
    payload = {
        "verdict_index": ledger_index,
        "verdict_decision": v["decision"],
        "link": v["certificate"]["link"],
        "signer_id": v["certificate"]["signature"]["signer_id"],
        "decision": body.decision,
        "note": body.note.strip(),
        "reviewer": reviewer,
        "advisory": None if body.advisory is None else {**body.advisory.model_dump(), "label": ADVISORY_LABEL},
        "agreed_with_ai": None if body.advisory is None else body.advisory.recommendation == body.decision,
    }
    entry = env.ledger.append("analyst_review", payload)
    return {"index": entry.index, "timestamp": entry.timestamp, "entry_hash": entry.entry_hash, **payload}


@app.get("/reviews", dependencies=[Depends(require("analyst"))])
def list_reviews(verdict_index: int | None = None):
    rows = _reviews()
    if verdict_index is not None:
        rows = [r for r in rows if r["verdict_index"] == verdict_index]
    return rows


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


@app.get("/calibration/far")
def calibration_far(n: int = Query(64, ge=8, le=1024), tau: float = Query(0.10, ge=0, le=0.5),
                    noise: float = Query(0.04, ge=0, le=0.5), trials: int = Query(100_000, ge=1000, le=200_000)):
    """Honest-block false-alarm rate: 100k Monte-Carlo trials vs the exact tail and the bounds."""
    return false_alarm_validation(n, tau, noise, trials)


# --- quantum lab (exact state-vector engine; display and education, never a verdict) ----------
@app.post("/quantum/teleport")
def quantum_teleport(body: TeleportIn):
    if body.state is not None and body.state not in sv.EIGENSTATES:
        raise HTTPException(422, f"state must be one of {sorted(sv.EIGENSTATES)}")
    psi = sv.EIGENSTATES[body.state] if body.state else sv.state_from_bloch(body.theta, body.phi)
    ch = body.channel.model()
    trace = sv.teleport(psi, ch, np.random.default_rng(body.seed))
    theta = body.theta if body.state is None else float(np.arccos(np.clip(trace.input_bloch[2], -1, 1)))
    phi = body.phi if body.state is None else float(np.arctan2(trace.input_bloch[1], trace.input_bloch[0]))
    return {**trace.to_dict(), "six_state_error_rate": sv.six_state_error_rate(ch), "qasm": sv.qasm(theta, phi)}


@app.post("/quantum/bsm")
def quantum_bsm(body: BsmIn):
    return sv.bsm_counts(body.shots, body.channel.model(), body.seed)


# --- acceptance report (D1-D6 criteria run against this build) --------------------------------
_ACCEPTANCE: dict = {}


@app.get("/report/acceptance")
def report_acceptance(refresh: bool = False):
    """Runs on a throw-away system (never the live ledger); cached until ?refresh=true."""
    if refresh or not _ACCEPTANCE:
        _ACCEPTANCE.clear()
        _ACCEPTANCE.update(acceptance.run())
    return _ACCEPTANCE


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
