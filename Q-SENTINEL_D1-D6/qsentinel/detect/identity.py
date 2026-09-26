"""Detector 6: identity and basis/provenance binding."""

from __future__ import annotations

from .models import DetectionEvidence, DetectorResult


def detect(evidence: DetectionEvidence) -> DetectorResult:
    identity_bad = evidence.verifier_id != evidence.expected_verifier_id
    basis_bad = evidence.basis_commitment != evidence.expected_basis_commitment
    provenance_bad = tuple(evidence.pair_ids) != tuple(evidence.expected_pair_ids)
    message_bad = not evidence.message_digest_ok
    detected = identity_bad or basis_bad or provenance_bad or message_bad
    return DetectorResult(
        name="D6_identity_binding_monitor",
        detected=detected,
        score=1.0 if detected else 0.0,
        threshold=0.5,
        details={
            "identity_mismatch": identity_bad,
            "basis_commitment_mismatch": basis_bad,
            "pair_provenance_mismatch": provenance_bad,
            "message_digest_mismatch": message_bad,
        },
    )
