"""D3 - Entanglement Integrity Monitor.

Uses sacrificial Bell pairs sampled from the same channel.
    CHSH (optimal settings):  S = sqrt(2) * (<ZZ> + <XX>)   honest -> 2*sqrt(2), local <= 2
    Fidelity with |Phi+>:     F = (1 + <XX> - <YY> + <ZZ>) / 4

Rules:
    CRITICAL  this check's S <= 2          entanglement gone, so there is no security at all
    WARNING   S dropped vs the link's frozen commissioning baseline by > z_crit standard errors
    WARNING   pooled fidelity over the rolling window < fidelity_min
Standard error of a correlator estimated from m pairs: sqrt((1 - c^2) / m), floored at 1/m.
"""

import math

from .base import DetectionContext, DetectorResult, Severity


def _chsh(c: dict[str, float]) -> float:
    return math.sqrt(2) * (c["ZZ"] + c["XX"])


def _fidelity(c: dict[str, float]) -> float:
    return (1 + c["XX"] - c["YY"] + c["ZZ"]) / 4


def _var_chsh(c: dict[str, float], pairs: int) -> float:
    m = max(pairs / 3, 1.0)
    var = [max(1 - c[k] ** 2, 1 / m) / m for k in ("ZZ", "XX")]
    return 2 * sum(var)


def run(ctx: DetectionContext) -> DetectorResult:
    name = "Entanglement Integrity Monitor"
    if ctx.bell is None:
        return DetectorResult("D3", name, False, Severity.INFO, None, None,
                              "skipped: no Bell-test data for this channel")
    cfg = ctx.settings.detectors
    c, pairs = ctx.bell, max(ctx.bell_pairs, 1)
    s, f = _chsh(c), _fidelity(c)
    st = ctx.monitor.state(ctx.link) if ctx.monitor else None

    z_drop, pooled_f, pooled_pairs = 0.0, f, pairs
    if st is not None:
        base = st.baseline.correlators
        se = math.sqrt(_var_chsh(c, pairs) + _var_chsh(base, st.baseline.pairs))
        z_drop = (_chsh(base) - s) / se if se > 0 else 0.0
        pooled, pooled_pairs = ctx.monitor.windowed_correlators(ctx.link, c, pairs)
        pooled_f = _fidelity(pooled)

    broken = s <= cfg.chsh_min
    dropped = z_drop > cfg.chsh_drop_z
    degraded = pooled_f < cfg.fidelity_min
    reasons = [r for r, on in (("CHSH at/below classical bound", broken),
                               (f"CHSH dropped {z_drop:.1f} sigma below commissioning baseline", dropped),
                               (f"pooled fidelity {pooled_f:.3f} < {cfg.fidelity_min}", degraded)) if on]
    return DetectorResult(
        detector="D3", name=name, alert=bool(reasons),
        severity=Severity.CRITICAL if broken else (Severity.WARNING if reasons else Severity.INFO),
        statistic=s, threshold=cfg.chsh_min,
        detail=(("; ".join(reasons) + " | ") if reasons else "")
        + f"CHSH S = {s:.3f} (Tsirelson 2.828, classical <= 2), fidelity F = {f:.3f}",
        extra={"chsh": s, "fidelity": f, "correlators": c, "z_drop_vs_baseline": z_drop,
               "pooled_fidelity": pooled_f, "pooled_pairs": pooled_pairs},
    )
