"""Pauli-channel fingerprinting: every verification is also free channel tomography.

An honest signature's outcomes are deterministic, so every mismatch is a channel error. Which
basis the error shows up in tells us WHICH Pauli error hit the qubit:

    Z-basis rounds are flipped by X or Y errors   ->  r_Z = pX + pY
    X-basis rounds are flipped by Z or Y errors   ->  r_X = pZ + pY
    Y-basis rounds are flipped by X or Z errors   ->  r_Y = pX + pZ

Solving gives the channel's Pauli vector (pX, pY, pZ) from the per-basis error rates.

Why it matters:
  * An eavesdropper who measures in ONE basis acts as a dephasing channel along that axis.
    It leaves a sharp single-axis fingerprint, even when the total QBER stays under the 11%
    threshold (a "stealth probe").
  * The link's own fingerprint is measured once at commissioning and FROZEN. Each verification
    is compared to it with a likelihood-ratio (G) test. No learning, no model: a fixed
    reference plus a textbook hypothesis test.
  * Known blind spot, stated honestly: an attacker who picks her basis uniformly at random
    produces an isotropic fingerprint, which looks exactly like depolarising noise (Pauli
    twirling). She is then detected by MAGNITUDE (QBER/CUSUM vs the baseline), not by shape.

Estimated intercepted fraction: every intercept-type attack applies a Pauli with total
probability 1/2 per attacked qubit, so  f ~= 2 * (sum of excess Pauli probabilities).
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass

import numpy as np
from scipy.stats import chi2

AXES = {0: "Z", 1: "X", 2: "Y"}

PerBasis = dict[int, tuple[int, int]]   # basis -> (errors, total)


def per_basis_counts(meas_bases: np.ndarray, mismatches: np.ndarray, bases=(0, 1, 2)) -> PerBasis:
    mb = np.asarray(meas_bases)
    mm = np.asarray(mismatches)
    return {int(b): (int(mm[mb == b].sum()), int((mb == b).sum())) for b in bases}


def pauli_vector(counts: PerBasis) -> dict[str, float] | None:
    """(pX, pY, pZ) from per-basis error rates. None unless Z, X and Y were all measured."""
    if any(counts.get(b, (0, 0))[1] == 0 for b in (0, 1, 2)):
        return None
    r = {b: e / t for b, (e, t) in counts.items()}
    rz, rx, ry = r[0], r[1], r[2]
    return {"pX": max(0.0, (rz + ry - rx) / 2), "pY": max(0.0, (rz + rx - ry) / 2),
            "pZ": max(0.0, (rx + ry - rz) / 2)}


def _g_2x2(e1: int, n1: int, e0: int, n0: int) -> float:
    """G statistic for 'same error rate' between current (e1/n1) and baseline (e0/n0)."""
    obs = np.array([[e1, n1 - e1], [e0, n0 - e0]], dtype=float)
    tot = obs.sum()
    if tot == 0 or n1 == 0 or n0 == 0:
        return 0.0
    exp = obs.sum(axis=1, keepdims=True) * obs.sum(axis=0, keepdims=True) / tot
    mask = obs > 0
    return float(2 * (obs[mask] * np.log(obs[mask] / exp[mask])).sum())


@dataclass
class Fingerprint:
    rates: dict[str, float]
    baseline_rates: dict[str, float] | None
    pauli: dict[str, float] | None
    excess_pauli: dict[str, float] | None
    g_stat: float
    p_value: float
    drift: bool
    label: str
    est_intercept_fraction: float | None

    def to_dict(self) -> dict:
        return asdict(self)


def _label(excess_rates: dict[int, float], excess_pauli: dict[str, float] | None,
           min_effect: float) -> str:
    if max(excess_rates.values(), default=0.0) < min_effect:
        return "nominal"
    if excess_pauli is not None:
        total = sum(excess_pauli.values())
        if total <= 0:
            return "anisotropic drift"
        top_axis, top = max(excess_pauli.items(), key=lambda kv: kv[1])
        lo = min(excess_pauli.values())
        axis = top_axis[1]
        if top / total >= 0.75:
            return f"single-axis probe along {axis}: eavesdropper measuring/entangling in the {axis} basis"
        if lo / top >= 0.5:
            return ("isotropic excess: random-basis intercept-resend OR extra depolarising noise "
                    "(indistinguishable by Pauli statistics - flagged by magnitude)")
        return "mixed anisotropic excess: multi-basis probe or hardware fault"
    rising = [AXES[b] for b, x in excess_rates.items() if x >= min_effect]
    return f"excess errors in basis {', '.join(rising)} (two-basis mode: partial attribution)"


def fingerprint(current: PerBasis, baseline: PerBasis | None, alpha: float,
                min_effect: float) -> Fingerprint:
    rates = {AXES[b]: (e / t if t else 0.0) for b, (e, t) in current.items()}
    pauli = pauli_vector(current)
    if baseline is None:
        return Fingerprint(rates, None, pauli, None, 0.0, 1.0, False,
                           "no commissioning baseline for this link", None)
    base_rates = {AXES[b]: (e / t if t else 0.0) for b, (e, t) in baseline.items()}
    g = sum(_g_2x2(*current[b], *baseline[b]) for b in current if b in baseline)
    df = sum(1 for b in current if b in baseline and current[b][1] and baseline[b][1])
    p = float(chi2.sf(g, df)) if df else 1.0
    excess_rates = {b: rates[AXES[b]] - base_rates[AXES[b]] for b in current if b in baseline}
    base_pauli = pauli_vector(baseline)
    excess_pauli = ({k: max(0.0, pauli[k] - base_pauli[k]) for k in pauli}
                    if pauli is not None and base_pauli is not None else None)
    drift = p < alpha and max(excess_rates.values(), default=0.0) >= min_effect
    est = 2 * sum(excess_pauli.values()) if excess_pauli is not None else None
    return Fingerprint(rates, base_rates, pauli, excess_pauli, g,
                       p if not math.isnan(p) else 1.0, drift,
                       _label(excess_rates, excess_pauli, min_effect), est)
