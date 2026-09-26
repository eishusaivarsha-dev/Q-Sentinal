"""CUSUM sequential drift detector."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CUSUMResult:
    statistic: float
    alarm: bool
    samples: int


def cusum_statistic(samples: list[float], target: float, reference: float = 0.0) -> float:
    """Return the final one-sided upper CUSUM statistic."""
    s = 0.0
    maximum = 0.0
    for x in samples:
        s = max(0.0, s + (x - target - reference))
        maximum = max(maximum, s)
    return maximum


def cusum_detect(samples: list[float], target: float, threshold: float, reference: float = 0.0) -> CUSUMResult:
    statistic = cusum_statistic(samples, target, reference=reference)
    return CUSUMResult(
        statistic=statistic,
        alarm=statistic >= threshold,
        samples=len(samples),
    )
