"""Teleportation-based Quantum Digital Signature protocol (see docs/protocol.md)."""

from __future__ import annotations

import hashlib
import secrets
import time
import uuid
from dataclasses import dataclass

import numpy as np

from ..config import ProtocolConfig
from ..quantum.backend import ChannelModel, QuantumBackend
from .keys import KeyAlreadyUsedError, PrivateKey, PublicKeyHandle


def keygen(signer_id: str, cfg: ProtocolConfig, seed: int | None = None) -> PrivateKey:
    """Private key = classical seed expanded into (L, 2, n) Pauli eigenstate selections.

    seed=None draws 256 bits from the OS CSPRNG. TODO(security-lead): optional QRNG source.
    """
    rng = np.random.default_rng(secrets.randbits(256) if seed is None else seed)
    shape = (cfg.hash_bits, 2, cfg.rounds_per_bit)
    return PrivateKey(
        key_id=uuid.uuid4().hex if seed is None else f"k-{seed}",
        signer_id=signer_id,
        bases=rng.choice(np.array(cfg.bases, dtype=np.uint8), size=shape),
        values=rng.integers(0, 2, size=shape, dtype=np.uint8),
    )


def distribute(priv: PrivateKey, verifier_id: str) -> PublicKeyHandle:
    """Teleport the quantum public key to one verifier.

    Physically: for every eigenstate, signer does a BSM with its half of a pre-shared |Phi+>,
    sends 2 classical bits, verifier applies {I, X, Z, XZ}. In the simulator the physics is
    executed lazily by the backend at verification time (only revealed blocks are ever measured).
    """
    return PublicKeyHandle(priv.key_id, priv.signer_id, verifier_id,
                           _states=(priv.bases, priv.values))


def message_digest(message: bytes, nonce: bytes, bits: int) -> np.ndarray:
    """SHAKE-256(message || nonce) -> `bits` digest bits (quantum-safe symmetric primitive)."""
    raw = hashlib.shake_256(message + nonce).digest((bits + 7) // 8)
    return np.unpackbits(np.frombuffer(raw, dtype=np.uint8))[:bits]


@dataclass
class Signature:
    signer_id: str
    key_id: str
    message: bytes
    nonce: bytes
    counter: int
    timestamp: float
    revealed_bases: np.ndarray   # (L, n)
    revealed_values: np.ndarray  # (L, n)

    def to_dict(self) -> dict:
        return {
            "signer_id": self.signer_id, "key_id": self.key_id,
            "message": self.message.decode("utf-8", errors="replace"),
            "nonce": self.nonce.hex(), "counter": self.counter, "timestamp": self.timestamp,
            "revealed_bases": self.revealed_bases.tolist(),
            "revealed_values": self.revealed_values.tolist(),
        }

    @classmethod
    def from_dict(cls, d: dict) -> Signature:
        return cls(
            signer_id=d["signer_id"], key_id=d["key_id"], message=d["message"].encode(),
            nonce=bytes.fromhex(d["nonce"]), counter=int(d["counter"]),
            timestamp=float(d["timestamp"]),
            revealed_bases=np.asarray(d["revealed_bases"], dtype=np.uint8),
            revealed_values=np.asarray(d["revealed_values"], dtype=np.uint8),
        )


def sign(priv: PrivateKey, message: bytes, counter: int) -> Signature:
    """Reveal, for each digest bit i, the key block matching that bit (Lamport-style)."""
    if priv.used:
        raise KeyAlreadyUsedError(priv.key_id)
    L, _ = priv.shape
    nonce = secrets.token_bytes(16)
    h = message_digest(message, nonce, L)
    rows = np.arange(L)
    priv.used = True
    return Signature(
        signer_id=priv.signer_id, key_id=priv.key_id, message=message, nonce=nonce,
        counter=counter, timestamp=time.time(),
        revealed_bases=priv.bases[rows, h].copy(), revealed_values=priv.values[rows, h].copy(),
    )


@dataclass
class VerificationTranscript:
    """Everything needed to re-derive the verdict later (anchored to the ledger, NFR-10)."""

    key_id: str
    verifier_id: str
    digest: np.ndarray            # (L,)
    block_mismatches: np.ndarray  # (L,) mismatches per digest-bit block
    mismatch_seq: np.ndarray      # (L*n,) 0/1 in measurement order (for SPRT/CUSUM)
    meas_bases: np.ndarray        # (L*n,) basis of each round (for the Pauli fingerprint)
    bsm: np.ndarray               # (L*n, 2) signer BSM outcomes
    rounds_per_bit: int
    seed: int
    backend: str

    @property
    def total_rounds(self) -> int:
        return int(self.mismatch_seq.size)

    @property
    def qber(self) -> float:
        return float(self.mismatch_seq.mean()) if self.mismatch_seq.size else 0.0

    def summary(self) -> dict:
        return {
            "key_id": self.key_id, "verifier_id": self.verifier_id,
            "digest_hex": np.packbits(self.digest).tobytes().hex(),
            "block_mismatches": self.block_mismatches.tolist(),
            "total_rounds": self.total_rounds, "qber": self.qber,
            "rounds_per_bit": self.rounds_per_bit, "seed": self.seed, "backend": self.backend,
        }


def verify(sig: Signature, pub: PublicKeyHandle, backend: QuantumBackend,
           channel: ChannelModel = ChannelModel(), seed: int | None = None) -> VerificationTranscript:
    """Measure the public-key block selected by the digest in the bases the signature reveals.

    Honest signature => every outcome equals the revealed value (deterministic, FRR = 0 noiseless).
    The accept/reject DECISION is not made here - it belongs to the detector engine (L2).
    """
    seed = secrets.randbits(63) if seed is None else seed
    L, n = pub.shape
    if sig.revealed_bases.shape != (L, n):
        raise ValueError("signature shape does not match public key")
    h = message_digest(sig.message, sig.nonce, L)
    rows = np.arange(L)
    true_b, true_v = pub._states[0][rows, h], pub._states[1][rows, h]
    res = backend.teleport_and_measure(true_b.ravel(), true_v.ravel(),
                                       sig.revealed_bases.ravel(), channel, seed)
    mism = (res.outcomes != sig.revealed_values.ravel()).astype(np.uint8)
    return VerificationTranscript(
        key_id=pub.key_id, verifier_id=pub.verifier_id, digest=h,
        block_mismatches=mism.reshape(L, n).sum(axis=1), mismatch_seq=mism,
        meas_bases=sig.revealed_bases.ravel().copy(), bsm=res.bsm,
        rounds_per_bit=n, seed=seed, backend=backend.name,
    )
