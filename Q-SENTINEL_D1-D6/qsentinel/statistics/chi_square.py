"""Chi-square goodness-of-fit helpers."""

from __future__ import annotations

import numpy as np
from scipy.stats import chisquare


def chi_square_uniformity(counts: dict[str, int]) -> dict[str, float]:
    """Test whether four BSM outcomes are consistent with a uniform distribution."""
    keys = ("00", "01", "10", "11")
    observed = np.array([counts.get(k, 0) for k in keys], dtype=float)
    total = observed.sum()
    if total <= 0:
        raise ValueError("At least one count is required")
    expected = np.full(4, total / 4.0)
    statistic, p_value = chisquare(observed, f_exp=expected)
    return {
        "chi2": float(statistic),
        "p_value": float(p_value),
        "degrees_of_freedom": 3.0,
        "uniform": float(p_value) > 0.05,
    }
