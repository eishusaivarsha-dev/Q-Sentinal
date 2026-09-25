"""FastAPI service. Interactive docs at http://localhost:8000/docs

TODO(security-lead): OAuth 2.1 + mTLS + RBAC in front of every route.
"""

from __future__ import annotations

import asyncio
import os

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ..attacks import ATTACKS, run_attack
from ..config import FAST, Settings
from ..detect.calibrate import tradeoff_table
from ..pipeline import QSentinel
from ..qds import Signature
from ..quantum import ChannelModel

SETTINGS = FAST if os.getenv("QSENTINEL_PROFILE", "fast") == "fast" else Settings()
env = QSentinel(settings=SETTINGS)
env.register_signer("alice")
env.register_verifier("bob")

app = FastAPI(title="Q-SENTINEL API", version="0.1.0",
              description="AI-free quantum threat detection for teleportation-based QDS")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
                   allow_methods=["*"], allow_headers=["*"])


class ChannelIn(BaseModel):
    depolarizing: float = Field(0.0, ge=0, le=0.75)
    intercept_fraction: float = Field(0.0, ge=0, le=1)


class SignIn(BaseModel):
    signer_id: str = "alice"
    message: str


class VerifyIn(BaseModel):
    signature: dict
    verifier_id: str = "bob"
    channel: ChannelIn = ChannelIn()


class AttackIn(BaseModel):
    attack: str
    strength: float = Field(1.0, ge=0, le=1)
    seed: int | None = None
    channel: ChannelIn = ChannelIn()


@app.get("/health")
def health():
    p = SETTINGS.protocol
    return {"status": "ok", "backend": env.backend.name, "basis_set": p.basis_set,
            "hash_bits": p.hash_bits, "rounds_per_bit": p.rounds_per_bit, "tau": p.tau,
            "pqc": env.ledger.signer.implementation}


@app.post("/signers/{signer_id}")
def add_signer(signer_id: str):
    env.register_signer(signer_id)
    return {"ok": True}


@app.post("/verifiers/{verifier_id}")
def add_verifier(verifier_id: str):
    env.register_verifier(verifier_id)
    return {"ok": True}


@app.post("/sign")
def sign(body: SignIn):
    try:
        sig = env.sign(body.signer_id, body.message.encode())
    except PermissionError as e:
        raise HTTPException(403, str(e)) from e
    return sig.to_dict()


@app.post("/verify")
def verify(body: VerifyIn):
    try:
        sig = Signature.from_dict(body.signature)
        verdict = env.verify(sig, body.verifier_id, ChannelModel(**body.channel.model_dump()))
    except KeyError as e:
        raise HTTPException(404, str(e)) from e
    return verdict.to_dict()


@app.get("/attacks")
def list_attacks():
    return [{"name": k, "expected": v[1], "detectors": v[2]} for k, v in ATTACKS.items()]


@app.post("/attacks/run")
def attack(body: AttackIn):
    if body.attack not in ATTACKS:
        raise HTTPException(404, f"unknown attack {body.attack}")
    try:
        rep = run_attack(env, body.attack, body.strength,
                         seed=body.seed if body.seed is not None else int.from_bytes(os.urandom(4)),
                         channel=ChannelModel(**body.channel.model_dump()))
    except NotImplementedError as e:
        raise HTTPException(501, f"{body.attack} not implemented yet") from e
    return {**rep.row(), "verdict": rep.verdict}


@app.get("/ledger")
def ledger(limit: int = 50):
    return [e.__dict__ for e in env.ledger.entries[-limit:]]


@app.get("/ledger/verify")
def ledger_verify():
    ok, msg = env.ledger.verify_chain()
    return {"ok": ok, "detail": msg}


@app.get("/calibration")
def calibration(target: float = 1e-16):
    return tradeoff_table(target)


@app.get("/telemetry")
def telemetry(since: int = 0):
    return env.telemetry.read(since)


@app.websocket("/ws/telemetry")
async def ws_telemetry(ws: WebSocket):
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
