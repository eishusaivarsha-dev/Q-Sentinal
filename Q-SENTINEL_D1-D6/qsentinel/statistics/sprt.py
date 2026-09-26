"""Wald sequential probability ratio test for Bernoulli mismatch streams."""

from __future__ import annotations

from dataclasses import dataclass
import math


@dataclass(frozen=True)
class SPRTResult:
    decision: str
    log_likelihood_ratio: float
    samples: int
    upper_boundary: float
    lower_boundary: float


def sprt(
    samples: list[int | bool],
    p0: float,
    p1: float,
    alpha: float = 0.01,
    beta: float = 0.01,
) -> SPRTResult:
    """Run a Bernoulli SPRT with H0:p=p0 and H1:p=p1."""
    if not 0 < p0 < 1 or not 0 < p1 < 1:
        raise ValueError("p0 and p1 must be in (0,1)")
    if p0 == p1:
        raise ValueError("p0 and p1 must differ")
    if not 0 < alpha < 1 or not 0 < beta < 1:
        raise ValueError("alpha and beta must be in (0,1)")
    upper = math.log((1.0 - beta) / alpha)
    lower = math.log(beta / (1.0 - alpha))
    llr = 0.0
    decision = "CONTINUE"
    for idx, sample in enumerate(samples, start=1):
        x = int(bool(sample))
        llr += math.log((p1 / p0) if x else ((1 - p1) / (1 - p0)))
        if llr >= upper:
            decision = "H1_ATTACK"
            return SPRTResult(decision, llr, idx, upper, lower)
        if llr <= lower:
            decision = "H0_NORMAL"
            return SPRTResult(decision, llr, idx, upper, lower)
    return SPRTResult(decision, llr, len(samples), upper, lower)
