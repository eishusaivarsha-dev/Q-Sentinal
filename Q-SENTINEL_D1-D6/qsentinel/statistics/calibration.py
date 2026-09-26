"""Closed-form and empirical threshold calibration (D5)."""

from __future__ import annotations

from dataclasses import dataclass
import math

import numpy as np
from scipy.stats import binom, norm

from .hoeffding import threshold_from_target_alpha, hoeffding_bound


@dataclass(frozen=True)
class CalibratedThresholds:
    mismatch_rate_threshold: float
    mismatch_count_threshold: int
    alpha: float
    beta: float
    target_far: float
    target_frr: float
    exact_far_at_count: float
    hoeffding_upper_bound_at_count: float


def exact_binomial_tail(n: int, p: float, threshold_count: int) -> float:
    """Return P[X >= threshold_count] for X~Binomial(n,p)."""
    if n <= 0:
        raise ValueError("n must be positive")
    if not 0 <= p <= 1:
        raise ValueError("p must be in [0,1]")
    if threshold_count < 0 or threshold_count > n:
        raise ValueError("threshold_count must be in [0,n]")
    if threshold_count == 0:
        return 1.0
    return float(binom.sf(threshold_count - 1, n, p))


def wilson_interval(successes: int, trials: int, confidence: float = 0.95) -> tuple[float, float]:
    """Wilson score interval for a Bernoulli probability."""
    if trials <= 0 or not 0 <= successes <= trials:
        raise ValueError("invalid successes/trials")
    if not 0 < confidence < 1:
        raise ValueError("confidence must be in (0,1)")
    z = float(norm.ppf(0.5 + confidence / 2.0))
    p = successes / trials
    denom = 1.0 + z * z / trials
    centre = (p + z * z / (2.0 * trials)) / denom
    half = (z / denom) * math.sqrt(p * (1.0 - p) / trials + z * z / (4.0 * trials * trials))
    return max(0.0, centre - half), min(1.0, centre + half)


def calibrate(
    n: int,
    *,
    baseline_mismatch: float = 0.0,
    target_far: float = 1e-6,
    target_frr: float = 1e-3,
) -> CalibratedThresholds:
    """Derive a conservative count threshold from a Hoeffding FAR budget.

    ``target_frr`` is carried as a calibration budget for integration; the
    deterministic threshold itself is chosen from the closed-form one-sided
    concentration bound, keeping the runtime trust path model-free.
    """
    if n <= 0:
        raise ValueError("n must be positive")
    if not 0 <= baseline_mismatch < 1:
        raise ValueError("baseline_mismatch must be in [0,1)")
    if not 0 < target_far < 1:
        raise ValueError("target_far must be in (0,1)")
    if not 0 < target_frr < 1:
        raise ValueError("target_frr must be in (0,1)")
    rate_threshold = threshold_from_target_alpha(n, baseline_mismatch, target_far)
    count_threshold = min(n, max(1, math.ceil(n * rate_threshold)))
    exact_far = exact_binomial_tail(n, baseline_mismatch, count_threshold)
    hb = hoeffding_bound(n, max(0.0, count_threshold / n - baseline_mismatch))
    return CalibratedThresholds(
        mismatch_rate_threshold=count_threshold / n,
        mismatch_count_threshold=count_threshold,
        alpha=target_far,
        beta=target_frr,
        target_far=target_far,
        target_frr=target_frr,
        exact_far_at_count=exact_far,
        hoeffding_upper_bound_at_count=hb,
    )


@dataclass(frozen=True)
class FARValidationReport:
    n: int
    baseline_rate: float
    threshold_count: int
    threshold_rate: float
    trials: int
    false_alarms: int
    empirical_far: float
    analytic_far: float
    hoeffding_bound: float
    confidence: float
    ci_low: float
    ci_high: float
    relative_error: float
    within_ten_percent: bool


def validate_false_alarm_rate(
    *,
    n: int,
    baseline_rate: float,
    threshold_count: int,
    trials: int = 100_000,
    seed: int = 2026,
    confidence: float = 0.95,
) -> FARValidationReport:
    """Run a reproducible Monte-Carlo FAR validation at the calibrated threshold.

    The exact binomial tail is used as the analytic operating-point reference;
    the Hoeffding value is reported separately as the provable conservative
    upper bound.  This distinction avoids falsely claiming that a loose
    concentration bound equals the finite-sample operating probability.
    """
    if trials <= 0:
        raise ValueError("trials must be positive")
    rng = np.random.default_rng(seed)
    mismatch_counts = rng.binomial(n, baseline_rate, size=trials)
    false_alarms = int(np.count_nonzero(mismatch_counts >= threshold_count))
    empirical = false_alarms / trials
    analytic = exact_binomial_tail(n, baseline_rate, threshold_count)
    eps = max(analytic, 1.0 / trials)
    relative_error = abs(empirical - analytic) / eps
    ci_low, ci_high = wilson_interval(false_alarms, trials, confidence=confidence)
    hoeffding = hoeffding_bound(n, max(0.0, threshold_count / n - baseline_rate))
    return FARValidationReport(
        n=n,
        baseline_rate=baseline_rate,
        threshold_count=threshold_count,
        threshold_rate=threshold_count / n,
        trials=trials,
        false_alarms=false_alarms,
        empirical_far=empirical,
        analytic_far=analytic,
        hoeffding_bound=hoeffding,
        confidence=confidence,
        ci_low=ci_low,
        ci_high=ci_high,
        relative_error=relative_error,
        within_ten_percent=relative_error <= 0.10,
    )
