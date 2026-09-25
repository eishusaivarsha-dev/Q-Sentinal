"""Sequential tests for early attack detection. OWNER: Detection Lead."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np


@dataclass
class SPRTResult:
    decision: str      # "attack" | "honest" | "undecided"
    rounds_used: int
    llr: float


def bernoulli_sprt(seq: np.ndarray, p0: float, p1: float, alpha: float, beta: float) -> SPRTResult:
    """Wald SPRT on a 0/1 mismatch sequence: H0 QBER = p0 (honest) vs H1 QBER = p1 (attack).

    Type-I error <= alpha, Type-II <= beta (Wald). Stops at the first boundary crossing.
    """
    upper = math.log((1 - beta) / alpha)
    lower = math.log(beta / (1 - alpha))
    inc1, inc0 = math.log(p1 / p0), math.log((1 - p1) / (1 - p0))
    llr = np.cumsum(np.where(np.asarray(seq) == 1, inc1, inc0))
    hit_up = np.flatnonzero(llr >= upper)
    hit_lo = np.flatnonzero(llr <= lower)
    first_up = hit_up[0] if hit_up.size else None
    first_lo = hit_lo[0] if hit_lo.size else None
    if first_up is not None and (first_lo is None or first_up < first_lo):
        return SPRTResult("attack", int(first_up) + 1, float(llr[first_up]))
    if first_lo is not None:
        return SPRTResult("honest", int(first_lo) + 1, float(llr[first_lo]))
    return SPRTResult("undecided", int(llr.size), float(llr[-1]) if llr.size else 0.0)


def cusum(seq: np.ndarray, target: float, slack: float, threshold: float) -> int | None:
    """One-sided CUSUM for upward drift of the mismatch rate. Returns alarm index or None.

    TODO(detection-lead): run across verifications (channel-level drift), not per signature.
    """
    s = 0.0
    for i, x in enumerate(np.asarray(seq, dtype=float)):
        s = max(0.0, s + x - target - slack)
        if s > threshold:
            return i
    return None
