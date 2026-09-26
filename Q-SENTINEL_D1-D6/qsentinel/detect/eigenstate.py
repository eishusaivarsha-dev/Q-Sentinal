"""Detector 1: deterministic eigenstate verification."""

from __future__ import annotations

from .models import DetectionEvidence, DetectorResult


def detect(evidence: DetectionEvidence, mismatch_threshold: int = 0) -> DetectorResult:
    """Alert when the observed projective outcomes exceed the allowed mismatches."""
    if len(evidence.observed) != len(evidence.expected):
        return DetectorResult(
            name="D1_eigenstate_verifier",
            detected=True,
            score=float("inf"),
            threshold=float(mismatch_threshold),
            details={"reason": "length_mismatch"},
        )
    mismatches = sum(a != b for a, b in zip(evidence.observed, evidence.expected))
    return DetectorResult(
        name="D1_eigenstate_verifier",
        detected=mismatches > mismatch_threshold,
        score=float(mismatches),
        threshold=float(mismatch_threshold),
        details={
            "mismatches": mismatches,
            "rounds": len(evidence.expected),
            "mismatch_rate": mismatches / max(1, len(evidence.expected)),
        },
    )
