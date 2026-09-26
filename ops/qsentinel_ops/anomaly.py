"""Unusual-verification finder (advisory): an Isolation Forest over every verdict's physics.

Detectors answer "is this signature valid?" with a fixed rule. This asks a different, softer
question for the analyst's queue: "which verifications look least like the others?" - e.g. a run
of accepted verdicts whose Pauli fingerprint quietly leans one way. It ranks; it never decides.
"""

from __future__ import annotations

import httpx
import numpy as np
from sklearn.ensemble import IsolationForest

from . import ADVISORY_LABEL

FEATURES = ["qber", "chsh", "fidelity", "excess_pX", "excess_pY", "excess_pZ", "cusum",
            "fingerprint_drift", "est_intercept", "alerts"]
NICE = {"qber": "error rate", "chsh": "CHSH value", "fidelity": "Bell fidelity", "excess_pX": "excess X errors",
        "excess_pY": "excess Y errors", "excess_pZ": "excess Z errors", "cusum": "CUSUM drift",
        "fingerprint_drift": "fingerprint drift", "est_intercept": "estimated interception",
        "alerts": "alert count"}


def fetch_all_verdicts(api: str, key: str | None = None) -> list[dict]:
    headers = {"X-API-Key": key} if key else {}
    events = httpx.get(f"{api}/telemetry", headers=headers, timeout=10).raise_for_status().json()
    return [e for e in events if e["kind"] == "verdict"]


def featurise(events: list[dict]) -> np.ndarray:
    rows = []
    for e in events:
        d = e["data"]
        ex = d.get("excess_pauli") or {}
        rows.append([d["qber"], d.get("chsh") or 2 * np.sqrt(2), d.get("fidelity") or 1.0,
                     ex.get("pX", 0.0), ex.get("pY", 0.0), ex.get("pZ", 0.0), d.get("cusum", 0.0),
                     float(bool(d.get("fingerprint_drift"))), d.get("est_intercept_fraction") or 0.0,
                     float(sum(a["severity"] != "info" and a["alert"] for a in d.get("alerts", [])))])
    return np.asarray(rows, dtype=float)


def rank(events: list[dict], top: int = 8) -> dict:
    if len(events) < 8:
        return {"label": ADVISORY_LABEL, "scored": len(events), "anomalies": [],
                "note": "needs at least 8 verifications to learn what normal looks like"}
    x = featurise(events)
    forest = IsolationForest(n_estimators=200, random_state=0).fit(x)
    raw = -forest.score_samples(x)                       # higher = easier to isolate = more unusual
    score = (raw - raw.min()) / (np.ptp(raw) or 1.0)
    mu, sd = x.mean(axis=0), x.std(axis=0)
    sd[sd == 0] = 1.0
    z = (x - mu) / sd
    out = []
    for i in np.argsort(-score)[:top]:
        e = events[i]
        drivers = [f"{NICE[FEATURES[j]]} {'high' if z[i, j] > 0 else 'low'} ({z[i, j]:+.1f}σ)"
                   for j in np.argsort(-np.abs(z[i]))[:2] if abs(z[i, j]) >= 1]
        out.append({"ledger_index": e["data"].get("ledger_index"), "link": e["data"].get("link"),
                    "decision": e["data"]["decision"], "ts": e["ts"], "score": float(score[i]),
                    "qber": e["data"]["qber"], "drivers": drivers or ["unusual combination of features"]})
    return {"label": ADVISORY_LABEL, "scored": len(events), "anomalies": out}
