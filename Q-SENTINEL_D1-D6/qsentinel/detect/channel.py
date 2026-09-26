"""Detector 4: quantum-channel anomaly detection."""

from __future__ import annotations

from .models import DetectionEvidence, DetectorResult
from qsentinel.statistics.chi_square import chi_square_uniformity
from qsentinel.statistics.cusum import cusum_detect
from qsentinel.statistics.sprt import sprt


def qber(observed: tuple[int, ...], expected: tuple[int, ...]) -> float:
    if len(observed) != len(expected):
        raise ValueError("Observed and expected sequences must have equal length")
    return sum(a != b for a, b in zip(observed, expected)) / max(1, len(expected))


def detect(
    evidence: DetectionEvidence,
    *,
    qber_threshold: float = 0.12,
    alpha: float = 0.01,
    beta: float = 0.01,
    honest_qber: float = 0.01,
    attack_qber: float | None = None,
) -> DetectorResult:
    """Combine QBER, BSM chi-square, CUSUM and SPRT evidence."""
    if not 0 < honest_qber < 1:
        raise ValueError("honest_qber must be in (0,1)")
    attack_qber = float(attack_qber if attack_qber is not None else max(0.2, qber_threshold + 0.13))
    if not honest_qber < attack_qber < 1:
        raise ValueError("attack_qber must exceed honest_qber and stay below 1")

    rate = qber(evidence.observed, evidence.expected)
    chi = chi_square_uniformity(evidence.bsm_counts) if evidence.bsm_counts else {
        "chi2": 0.0,
        "p_value": 1.0,
        "degrees_of_freedom": 3.0,
        "uniform": True,
    }
    mismatch_stream = [int(a != b) for a, b in zip(evidence.observed, evidence.expected)]
    # Bernoulli CUSUM with a midpoint reference between H0 and H1.
    k = (attack_qber - honest_qber) / 2.0
    h = max(3.0, np_sqrt_safe(len(mismatch_stream)) * 2.0)
    cusum = cusum_detect(
        mismatch_stream,
        target=honest_qber,
        threshold=h,
        reference=k,
    )
    seq = sprt(
        mismatch_stream,
        p0=honest_qber,
        p1=attack_qber,
        alpha=alpha,
        beta=beta,
    )
    detected = (
        rate >= qber_threshold
        or not chi["uniform"]
        or cusum.alarm
        or seq.decision == "H1_ATTACK"
    )
    return DetectorResult(
        name="D4_channel_anomaly_detector",
        detected=detected,
        score=float(rate),
        threshold=float(qber_threshold),
        details={
            "qber": float(rate),
            "qber_threshold": float(qber_threshold),
            "chi_square": chi,
            "cusum": {
                "statistic": float(cusum.statistic),
                "alarm": bool(cusum.alarm),
                "reference": float(k),
                "threshold": float(h),
            },
            "sprt": {
                "decision": seq.decision,
                "samples": int(seq.samples),
                "log_likelihood_ratio": float(seq.log_likelihood_ratio),
                "upper_boundary": float(seq.upper_boundary),
                "lower_boundary": float(seq.lower_boundary),
            },
            "qber_two_basis_intercept_resend_reference": 0.25,
            "qber_six_state_intercept_resend_reference": 1 / 3,
        },
    )


def np_sqrt_safe(value: int) -> float:
    # Small local helper avoids importing a numerical stack into the detector
    # beyond the already-required standard library/math functionality.
    import math
    return math.sqrt(max(1, value))
