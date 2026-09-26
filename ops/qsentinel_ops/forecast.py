"""Channel forecasting: where is each quantum link heading? (advisory, dossier D12)

Holt's linear exponential smoothing over each link's per-verification QBER and CHSH history
(plain NumPy, no model file). It answers the SOC's "should I re-route before this breaks?"
question: the projected error rate, an 80% band, and how many verifications remain before the
projection crosses the detector thresholds (QBER 11%, CHSH 2). The detectors, not this forecast,
still decide every verdict.
"""

from __future__ import annotations

import math

import httpx
import numpy as np

from . import ADVISORY_LABEL

QBER_ALARM = 0.11
CHSH_CLASSICAL = 2.0


def fetch_links(api: str, key: str | None = None, history: int = 100) -> dict:
    headers = {"X-API-Key": key} if key else {}
    return httpx.get(f"{api}/links?history={history}", headers=headers, timeout=10).raise_for_status().json()


def holt(series: list[float], alpha: float = 0.5, beta: float = 0.3, horizon: int = 10) -> dict:
    """Level + trend smoothing; returns the forecast and a residual-based 80% band."""
    y = np.asarray(series, dtype=float)
    level, trend = y[0], (y[1] - y[0]) if y.size > 1 else 0.0
    residuals = []
    for v in y[1:]:
        pred = level + trend
        residuals.append(v - pred)
        new_level = alpha * v + (1 - alpha) * pred
        trend = beta * (new_level - level) + (1 - beta) * trend
        level = new_level
    sigma = float(np.std(residuals)) if len(residuals) > 2 else 0.0
    steps = np.arange(1, horizon + 1)
    fc = level + trend * steps
    band = 1.2816 * sigma * np.sqrt(steps)
    return {"level": float(level), "trend": float(trend), "sigma": sigma, "forecast": fc.tolist(),
            "low": (fc - band).tolist(), "high": (fc + band).tolist()}


def _steps_until(level: float, trend: float, limit: float, rising: bool) -> int | None:
    if (rising and level >= limit) or (not rising and level <= limit):
        return 0
    if (rising and trend <= 1e-6) or (not rising and trend >= -1e-6):
        return None
    return math.ceil((limit - level) / trend)


def forecast_link(name: str, link: dict, horizon: int = 10) -> dict:
    hist = link.get("history") or []
    qber = [p["qber"] for p in hist]
    chsh = [p["chsh"] for p in hist if p.get("chsh") is not None]
    out: dict = {"link": name, "status": link.get("status"), "points": len(qber)}
    if len(qber) < 3:
        return {**out, "risk": "unknown", "note": "needs at least 3 verifications on this link"}
    q = holt(qber, horizon=horizon)
    q_steps = _steps_until(q["level"], q["trend"], QBER_ALARM, rising=True)
    out["qber"] = {**q, "history": qber[-30:], "steps_to_alarm": q_steps}
    c_steps = None
    if len(chsh) >= 3:
        c = holt(chsh, horizon=horizon)
        c_steps = _steps_until(c["level"], c["trend"], CHSH_CLASSICAL, rising=False)
        out["chsh"] = {**c, "history": chsh[-30:], "steps_to_classical": c_steps}
    soonest = min((s for s in (q_steps, c_steps) if s is not None), default=None)
    if soonest == 0:
        risk = "high"
    elif soonest is not None and soonest <= horizon:
        risk = "elevated"
    elif q["level"] > QBER_ALARM / 2 or q["high"][-1] > QBER_ALARM:
        risk = "watch"
    else:
        risk = "low"
    out["risk"] = risk
    out["steps_to_breach"] = soonest
    return out


def forecast_all(links: dict, horizon: int = 10) -> dict:
    return {"label": ADVISORY_LABEL, "horizon": horizon,
            "links": [forecast_link(n, link, horizon) for n, link in sorted(links.items())]}
