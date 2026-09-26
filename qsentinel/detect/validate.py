"""Empirical validation of the analytic forgery bound through the real quantum simulator.

Forger model (the one behind q = 1/3 six-state / 1/4 two-basis): she obtained one copy of each
public-key qubit, measured it in a random basis, and declares (her basis, her result).
    right basis  (prob 1/|B|)       -> always passes
    wrong basis  (prob 1 - 1/|B|)   -> verifier's outcome is a coin flip
so her per-round mismatch probability is exactly q.

    python -m qsentinel.detect.validate --n 16 --tau 0.1 --blocks 20000

Deliverable D5 acceptance criterion: empirical pass rate within +-10% of the exact bound.

`false_alarm_validation` (from Anansh Jain's D5 module) does the same for the other error: how
often an HONEST block on a noisy channel is rejected, checked by 100,000 Monte-Carlo trials against
the exact binomial tail, with the Chernoff and Hoeffding ceilings reported separately (a loose
bound is a guarantee, not the operating probability).
"""

from __future__ import annotations

import argparse
import math

import numpy as np

from ..config import BASIS_SETS, FORGER_MISMATCH
from ..quantum import ChannelModel, get_backend
from .calibrate import (
    forgery_bound,
    forgery_exact,
    hoeffding_bound,
    honest_rejection_bound,
    honest_rejection_exact,
    wilson_interval,
)


def monte_carlo_forgery(n: int, tau: float, blocks: int, basis_set: str = "six-state",
                        seed: int = 0) -> dict:
    rng = np.random.default_rng(seed)
    bases = np.array(BASIS_SETS[basis_set])
    size = n * blocks
    true_b = rng.choice(bases, size)
    true_v = rng.integers(0, 2, size)
    forger_b = rng.choice(bases, size)
    forger_v = np.where(forger_b == true_b, true_v, rng.integers(0, 2, size))
    res = get_backend().teleport_and_measure(true_b, true_v, forger_b, ChannelModel(), seed)
    mism = (res.outcomes != forger_v).reshape(blocks, n).sum(axis=1)
    passed = mism <= math.floor(tau * n)
    q = FORGER_MISMATCH[basis_set]
    empirical = float(passed.mean())
    exact = forgery_exact(n, tau, q)
    return {
        "n": n, "tau": tau, "blocks": blocks, "basis_set": basis_set,
        "per_round_mismatch": float((res.outcomes != forger_v).mean()), "q_theory": q,
        "pass_rate_empirical": empirical, "pass_rate_exact": exact,
        "chernoff_bound": forgery_bound(n, tau, q),
        "relative_error": abs(empirical - exact) / exact if exact else float("nan"),
    }


def false_alarm_validation(n: int, tau: float, noise: float, trials: int = 100_000,
                           seed: int = 2026) -> dict:
    """Honest blocks with QBER `noise` are rejected when mismatches > floor(tau * n)."""
    rng = np.random.default_rng(seed)
    limit = math.floor(tau * n)
    alarms = int(np.count_nonzero(rng.binomial(n, noise, size=trials) > limit))
    exact = honest_rejection_exact(n, tau, noise)
    lo, hi = wilson_interval(alarms, trials)
    return {
        "n": n, "tau": tau, "noise": noise, "limit": limit, "trials": trials, "false_alarms": alarms,
        "far_empirical": alarms / trials, "far_exact": exact, "ci95": [lo, hi],
        "chernoff_bound": honest_rejection_bound(n, tau, noise),
        "hoeffding_bound": hoeffding_bound(n, (limit + 1) / n - noise),
        "exact_inside_ci": lo <= exact <= hi,
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=16)
    ap.add_argument("--tau", type=float, default=0.10)
    ap.add_argument("--blocks", type=int, default=20_000)
    ap.add_argument("--basis-set", default="six-state", choices=list(BASIS_SETS))
    a = ap.parse_args()
    for k, v in monte_carlo_forgery(a.n, a.tau, a.blocks, a.basis_set).items():
        print(f"{k:22} {v}")
