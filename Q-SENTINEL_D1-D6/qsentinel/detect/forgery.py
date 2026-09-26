"""Detector 2: forgery probability estimator."""

from __future__ import annotations

from .models import DetectionEvidence, DetectorResult
from qsentinel.statistics.chernoff import chernoff_bound
from qsentinel.statistics.hoeffding import hoeffding_bound


def detect(
    evidence: DetectionEvidence,
    *,
    baseline_rate: float = 0.0,
    alpha: float = 1e-6,
) -> DetectorResult:
    """Estimate the probability of observing a mismatch rate this large."""
    if not 0 <= baseline_rate < 1:
        raise ValueError("baseline_rate must be in [0,1)")
    if not 0 < alpha < 1:
        raise ValueError("alpha must be in (0,1)")
    if len(evidence.observed) != len(evidence.expected):
        return DetectorResult(
            name="D2_forgery_estimator",
            detected=True,
            score=0.0,
            threshold=float(alpha),
            details={"reason": "length_mismatch"},
        )

    n = len(evidence.expected)
    mismatches = sum(a != b for a, b in zip(evidence.observed, evidence.expected))
    rate = mismatches / max(1, n)
    if rate <= baseline_rate:
        upper = 1.0
        hoeffding = 1.0
        chernoff = 1.0
    else:
        epsilon = rate - baseline_rate
        hoeffding = hoeffding_bound(n, epsilon)
        # A tiny floor only avoids a singular log expression at q=0.
        chernoff = chernoff_bound(n, rate, max(baseline_rate, 1e-12))
        upper = min(hoeffding, chernoff)
    detected = rate > baseline_rate and upper <= alpha
    return DetectorResult(
        name="D2_forgery_estimator",
        detected=detected,
        score=float(upper),
        threshold=float(alpha),
        details={
            "mismatch_rate": rate,
            "hoeffding_bound": float(hoeffding),
            "chernoff_bound": float(chernoff),
            "forgery_probability_upper_bound": float(upper),
            "rounds": n,
        },
    )
