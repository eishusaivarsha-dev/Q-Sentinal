"""D3 - Entanglement Integrity Monitor.

Uses sacrificial Bell pairs sampled from the same channel (channel-level, not per signature:
the statistical error on S is ~4/sqrt(N)).
    CHSH (optimal settings):  S = sqrt(2) * (<ZZ> + <XX>)   honest -> 2*sqrt(2), local <= 2
    Fidelity with |Phi+>:     F = (1 + <XX> - <YY> + <ZZ>) / 4
"""

import math

from .base import DetectionContext, DetectorResult, Severity


def run(ctx: DetectionContext) -> DetectorResult:
    if ctx.bell is None:
        return DetectorResult("D3", "Entanglement Integrity Monitor", False, Severity.INFO,
                              None, None, "skipped: no Bell-test data for this channel")
    c = ctx.bell
    s = math.sqrt(2) * (c["ZZ"] + c["XX"])
    f = (1 + c["XX"] - c["YY"] + c["ZZ"]) / 4
    cfg = ctx.settings.detectors
    broken = s <= cfg.chsh_min
    degraded = f < cfg.fidelity_min
    return DetectorResult(
        detector="D3", name="Entanglement Integrity Monitor", alert=broken or degraded,
        severity=Severity.CRITICAL if broken else (Severity.WARNING if degraded else Severity.INFO),
        statistic=s, threshold=cfg.chsh_min,
        detail=f"CHSH S = {s:.3f} (Tsirelson 2.828, classical <= 2), fidelity F = {f:.3f}",
        extra={"chsh": s, "fidelity": f, "correlators": c},
    )
