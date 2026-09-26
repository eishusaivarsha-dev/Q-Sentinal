"""Measurement aggregation helpers."""

from __future__ import annotations

from collections import Counter
from typing import Iterable


def mismatch_count(observed: Iterable[int], expected: Iterable[int]) -> int:
    observed = list(observed)
    expected = list(expected)
    if len(observed) != len(expected):
        raise ValueError("Observed and expected sequences must have equal length")
    return sum(int(a != b) for a, b in zip(observed, expected))


def mismatch_rate(observed: Iterable[int], expected: Iterable[int]) -> float:
    observed = list(observed)
    if not observed:
        return 0.0
    return mismatch_count(observed, expected) / len(observed)


def outcome_counts(outcomes: Iterable[int]) -> dict[str, int]:
    c = Counter(int(v) for v in outcomes)
    return {"0": int(c.get(0, 0)), "1": int(c.get(1, 0))}
