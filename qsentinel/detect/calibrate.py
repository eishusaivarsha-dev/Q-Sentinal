"""Closed-form threshold calibration (D5 deliverable). OWNER: Detection Lead.

All bounds are exact Chernoff (KL-divergence) tail bounds for Bernoulli mismatch counts:
    P[Bin(n, q) <= tau*n] <= exp(-n * KL(tau || q))   for tau < q   (forger passes)
    P[Bin(n, p) >  tau*n] <= exp(-n * KL(tau || p))   for tau > p   (honest rejected)
With tau = 0 the forgery bound reduces to (1 - q)^n, e.g. (3/4)^128 = 1.02e-16.
"""

from __future__ import annotations

import math


def kl_bernoulli(a: float, p: float) -> float:
    """KL(Bern(a) || Bern(p)) in nats."""
    def term(x: float, y: float) -> float:
        return 0.0 if x == 0 else x * math.log(x / y)
    return term(a, p) + term(1 - a, 1 - p)


def forgery_bound(n: int, tau: float, forger_mismatch: float) -> float:
    """Upper bound on P[an uninformed forger passes one n-round block with threshold tau]."""
    if tau >= forger_mismatch:
        return 1.0
    return math.exp(-n * kl_bernoulli(tau, forger_mismatch))


def honest_rejection_bound(n: int, tau: float, noise: float) -> float:
    """Upper bound on P[an honest block is rejected] on a channel with QBER `noise`."""
    if noise == 0:
        return 0.0
    if tau <= noise:
        return 1.0
    return math.exp(-n * kl_bernoulli(tau, noise))


def rounds_needed(target: float, tau: float, forger_mismatch: float) -> int:
    """Smallest n with forgery_bound(n, tau, q) <= target."""
    d = kl_bernoulli(tau, forger_mismatch)
    if d <= 0:
        raise ValueError("tau must be below the forger's mismatch rate")
    return math.ceil(math.log(1 / target) / d)


def tradeoff_table(target: float = 1e-16, taus=(0.0, 0.05, 0.10, 0.15)) -> list[dict]:
    """The n-vs-noise-tolerance table from docs/protocol.md."""
    return [{"tau": t, "two_basis_n": rounds_needed(target, t, 0.25),
             "six_state_n": rounds_needed(target, t, 1 / 3)} for t in taus]
