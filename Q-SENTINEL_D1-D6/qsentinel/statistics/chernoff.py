"""Chernoff/KL bound utilities for Bernoulli events."""

from __future__ import annotations

import math


def _clip(p: float, eps: float = 1e-12) -> float:
    return min(max(p, eps), 1.0 - eps)


def kl_divergence_bernoulli(p: float, q: float) -> float:
    """D(p || q) for Bernoulli distributions."""
    if not 0 <= p <= 1 or not 0 <= q <= 1:
        raise ValueError("p and q must be in [0,1]")
    if p == 0 and q == 0:
        return 0.0
    if p == 1 and q == 1:
        return 0.0
    p = _clip(p)
    q = _clip(q)
    return p * math.log(p / q) + (1 - p) * math.log((1 - p) / (1 - q))


def chernoff_bound(n: int, observed_rate: float, null_rate: float) -> float:
    """One-sided exponential bound exp(-n D(observed || null))."""
    if n <= 0:
        raise ValueError("n must be positive")
    d = kl_divergence_bernoulli(observed_rate, null_rate)
    return math.exp(-n * d)
