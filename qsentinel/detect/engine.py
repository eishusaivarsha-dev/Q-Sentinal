"""Runs D1-D6 and produces the verdict + proof certificate.

THIS IS THE TRUST PATH. No learned model may influence anything in this package
(NFR-1, enforced by lint-imports and tests/test_no_ml_in_trust_path.py).
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass

from . import d1_eigenstate, d2_forgery, d3_entanglement, d4_channel, d5_replay, d6_identity
from .base import DetectionContext, DetectorResult, Severity

DETECTORS = (d1_eigenstate, d2_forgery, d3_entanglement, d4_channel, d5_replay, d6_identity)


@dataclass
class Verdict:
    decision: str                     # "ACCEPT" | "REJECT"
    results: list[DetectorResult]
    certificate: dict

    @property
    def alerts(self) -> list[DetectorResult]:
        return [r for r in self.results if r.alert and r.severity != Severity.INFO]

    def result(self, detector: str) -> DetectorResult:
        return next(r for r in self.results if r.detector == detector)

    def to_dict(self) -> dict:
        return {"decision": self.decision, "results": [r.to_dict() for r in self.results],
                "certificate": self.certificate}


def evaluate(ctx: DetectionContext) -> Verdict:
    results = [d.run(ctx) for d in DETECTORS]
    by_id = {r.detector: r for r in results}
    reject = any(r.alert and r.severity == Severity.CRITICAL for r in results)
    decision = "REJECT" if reject else "ACCEPT"
    sig = ctx.signature
    if decision == "ACCEPT":   # consume nonce + one-time key only for accepted signatures
        ctx.nonces.commit(signer_id=sig.signer_id, verifier_id=ctx.pubkey.verifier_id,
                          nonce_hex=sig.nonce.hex(), counter=sig.counter, key_id=sig.key_id)
    if ctx.monitor is not None and not by_id["D2"].alert:
        # Only honest-looking transcripts describe the CHANNEL (a forger's mismatches do not).
        d4 = by_id["D4"].extra
        ctx.monitor.record(ctx.link, ctx.bell, ctx.bell_pairs, d4["cusum"], d4["cusum_alarm"])
    return Verdict(decision, results, _certificate(ctx, decision, results))


def _certificate(ctx: DetectionContext, decision: str, results: list[DetectorResult]) -> dict:
    """Proof-carrying verdict: everything a regulator needs to re-derive the decision."""
    p = ctx.settings.protocol
    d2 = next(r for r in results if r.detector == "D2")
    d4 = next(r for r in results if r.detector == "D4")
    body = {
        "decision": decision,
        "issued_at": time.time(),
        "protocol": {"basis_set": p.basis_set, "hash_bits": p.hash_bits,
                     "rounds_per_bit": p.rounds_per_bit, "tau_applied": d2.extra["tau"],
                     "transferred": ctx.transferred},
        "transcript": ctx.transcript.summary(),
        "signature": {"signer_id": ctx.signature.signer_id, "key_id": ctx.signature.key_id,
                      "nonce": ctx.signature.nonce.hex(), "counter": ctx.signature.counter},
        "link": ctx.link,
        "forgery_bound_per_block": d2.extra["forgery_bound_per_block"],
        "forgery_exact_per_block": d2.extra["forgery_exact_per_block"],
        "channel_fingerprint": d4.extra["fingerprint"]["label"],
        "alerts": [f"{r.detector}: {r.detail}" for r in results
                   if r.alert and r.severity != Severity.INFO],
        "ai_in_trust_path": False,
    }
    body["transcript_hash"] = hashlib.sha3_256(
        json.dumps(body["transcript"], sort_keys=True).encode()).hexdigest()
    return body
