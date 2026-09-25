"""FastAPI service. Interactive docs at http://localhost:8000/docs

Access control (RBAC). Set QSENTINEL_API_KEYS to enable it:
    QSENTINEL_API_KEYS="k1=alice:signer,k2=bob:verifier,k3=soc:analyst,k4=root:admin"
Clients send the key in the `X-API-Key` header (WebSocket: `?key=`). Identity comes from the
key, NOT from the request body: a signer can only sign as itself, and a verifier can only
verify as itself. That stops impersonation and unauthorised verification at the perimeter,
before D6 even runs. Without QSENTINEL_API_KEYS the API runs in open DEV MODE (as admin).

Roles: signer (sign) | verifier (verify) | analyst (read ledger/telemetry/links) |
       redteam (run attacks) | admin (everything)
TODO(security-lead): OAuth 2.1 / mTLS in front for production; keys in Vault, not env vars.
"""

from __future__ import annotations

import asyncio
import hmac
import os
from dataclasses import dataclass

from fastapi import Depends, FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ..attacks import ATTACKS, run_attack
from ..config import FAST, Settings
from ..detect.calibrate import tradeoff_table
from ..ledger import audit
from ..pipeline import QSentinel
from ..qds import Signature
from ..quantum import ChannelModel

SETTINGS = FAST if os.getenv("QSENTINEL_PROFILE", "fast") == "fast" else Settings()
env = QSentinel(settings=SETTINGS)
env.register_signer("alice")
env.register_verifier("bob")

app = FastAPI(title="Q-SENTINEL API", version="0.2.0",
              description="AI-free quantum threat detection for teleportation-based QDS")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
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
    entangle_fraction: float = Field(0.0, ge=0, le=1)


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


# --- routes --------------------------------------------------------------------------------
@app.get("/health")
def health():
    p = SETTINGS.protocol
    from ..pqc import kem
    return {"status": "ok", "backend": env.backend.name, "basis_set": p.basis_set,
            "hash_bits": p.hash_bits, "rounds_per_bit": p.rounds_per_bit, "tau": p.tau,
            "tau_transfer": p.tau_transfer, "symmetrise": p.symmetrise,
            "pqc": env.ledger.signer.implementation, "kem": kem.implementation(),
            "auth": "dev-open" if not _key_table() else "api-keys"}


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
    return {"key_id": env.issue_honeypot(signer_id)}


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
        verdict = env.verify(sig, verifier, ChannelModel(**body.channel.model_dump()),
                             transferred=body.transferred)
    except KeyError as e:
        raise HTTPException(404, str(e)) from e
    return verdict.to_dict()


@app.get("/attacks")
def list_attacks():
    return [{"name": k, "expected": v.expected, "detectors": v.detectors,
             "default_strength": v.default_strength} for k, v in ATTACKS.items()]


@app.post("/attacks/run", dependencies=[Depends(require("redteam"))])
def attack(body: AttackIn):
    if body.attack not in ATTACKS:
        raise HTTPException(404, f"unknown attack {body.attack}")
    try:
        rep = run_attack(env, body.attack, body.strength,
                         seed=body.seed if body.seed is not None else int.from_bytes(os.urandom(4)),
                         channel=ChannelModel(**body.channel.model_dump()))
    except NotImplementedError as e:
        raise HTTPException(501, f"{body.attack} not implemented yet") from e
    return {**rep.row(), "metrics": rep.metrics, "verdict": rep.verdict}


@app.get("/ledger", dependencies=[Depends(require("analyst"))])
def ledger(limit: int = 50):
    return [e.__dict__ for e in env.ledger.entries[-limit:]]


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


@app.get("/links", dependencies=[Depends(require("analyst"))])
def links():
    return env.monitor.status()


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
    last = 0
    try:
        while True:
            for event in env.telemetry.read(last):
                await ws.send_json(event)
                last = event["seq"]
            await asyncio.sleep(0.25)
    except WebSocketDisconnect:
        return
