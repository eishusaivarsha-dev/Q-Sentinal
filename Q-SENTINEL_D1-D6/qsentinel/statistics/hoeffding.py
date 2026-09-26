"""Hoeffding bounds for bounded Bernoulli mismatch rates."""

from __future__ import annotations

import math


def hoeffding_bound(n: int, epsilon: float) -> float:
    """Return exp(-2 n epsilon^2) for a Bernoulli sample mean."""
    if n <= 0:
        raise ValueError("n must be positive")
    if epsilon < 0:
        raise ValueError("epsilon must be non-negative")
    return math.exp(-2.0 * n * epsilon * epsilon)


def threshold_from_target_alpha(n: int, baseline_rate: float, alpha: float) -> float:
    """Upper threshold derived from Hoeffding at target Type-I error alpha."""
    if not 0 < alpha < 1:
        raise ValueError("alpha must be in (0,1)")
    if not 0 <= baseline_rate <= 1:
        raise ValueError("baseline_rate must be in [0,1]")
    epsilon = math.sqrt(math.log(1.0 / alpha) / (2.0 * n))
    return min(1.0, baseline_rate + epsilon)
