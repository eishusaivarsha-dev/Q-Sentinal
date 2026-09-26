"""Closed-form threshold calibration (D5 deliverable). OWNER: Detection Lead.

Two families of bounds for Bernoulli mismatch counts, with threshold limit = floor(tau * n):

  Chernoff (KL) tail bounds - simple, monotone, what the pitch quotes:
    P[Bin(n, q) <= tau*n] <= exp(-n * KL(tau || q))   for tau < q   (forger passes)
    P[Bin(n, p) >  tau*n] <= exp(-n * KL(tau || p))   for tau > p   (honest rejected)
  Exact binomial tails - the true probability under the per-round model (always <= Chernoff).

With tau = 0 the forgery bound reduces to (1 - q)^n, e.g. (3/4)^128 = 1.02e-16.

Hoeffding bounds and the Wilson interval come from Anansh Jain's D5 statistics module: Hoeffding
is looser than Chernoff but needs nothing except n and the gap, which makes it the simplest
provable ceiling to quote next to the exact tail.
"""

from __future__ import annotations

import math

from scipy.stats import binom, norm


def kl_bernoulli(a: float, p: float) -> float:
    """KL(Bern(a) || Bern(p)) in nats."""
    def term(x: float, y: float) -> float:
        return 0.0 if x == 0 else x * math.log(x / y)
    return term(a, p) + term(1 - a, 1 - p)


def forgery_bound(n: int, tau: float, forger_mismatch: float) -> float:
    """Chernoff upper bound on P[an uninformed forger passes one n-round block]."""
    if tau >= forger_mismatch:
        return 1.0
    return math.exp(-n * kl_bernoulli(tau, forger_mismatch))


def forgery_exact(n: int, tau: float, forger_mismatch: float) -> float:
    """Exact P[Bin(n, q) <= floor(tau*n)] - the forger's true pass probability per block."""
    return float(binom.cdf(math.floor(tau * n), n, forger_mismatch))


def honest_rejection_bound(n: int, tau: float, noise: float) -> float:
    """Chernoff upper bound on P[an honest block is rejected] on a channel with QBER `noise`."""
    if noise == 0:
        return 0.0
    if tau <= noise:
        return 1.0
    return math.exp(-n * kl_bernoulli(tau, noise))


def honest_rejection_exact(n: int, tau: float, noise: float) -> float:
    """Exact P[Bin(n, p) > floor(tau*n)]."""
    return float(binom.sf(math.floor(tau * n), n, noise))


def hoeffding_bound(n: int, gap: float) -> float:
    """P[sample mean exceeds its expectation by >= gap] <= exp(-2 n gap^2)."""
    if n <= 0:
        raise ValueError("n must be positive")
    return math.exp(-2.0 * n * max(0.0, gap) ** 2)


def hoeffding_threshold(n: int, baseline_rate: float, alpha: float) -> float:
    """Mismatch-rate threshold whose false-alarm probability Hoeffding caps at alpha."""
    if not 0 < alpha < 1:
        raise ValueError("alpha must be in (0, 1)")
    return min(1.0, baseline_rate + math.sqrt(math.log(1.0 / alpha) / (2.0 * n)))


def wilson_interval(successes: int, trials: int, confidence: float = 0.95) -> tuple[float, float]:
    """Wilson score interval for a Bernoulli probability (well-behaved near 0 and 1)."""
    if trials <= 0 or not 0 <= successes <= trials:
        raise ValueError("invalid successes/trials")
    z = float(norm.ppf(0.5 + confidence / 2.0))
    p = successes / trials
    denom = 1.0 + z * z / trials
    centre = (p + z * z / (2.0 * trials)) / denom
    half = (z / denom) * math.sqrt(p * (1.0 - p) / trials + z * z / (4.0 * trials * trials))
    return max(0.0, centre - half), min(1.0, centre + half)


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
