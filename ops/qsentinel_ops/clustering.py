"""Alert-storm clustering: collapse many correlated alerts into a few incidents (target: >= 60%
alert-volume reduction, dossier D12).

Reads the core API's telemetry only (read-only; the API key needs just the analyst role).

    python -m qsentinel_ops.clustering --api http://localhost:8000
"""

from __future__ import annotations

import argparse
import os

import httpx
import numpy as np
from sklearn.cluster import DBSCAN

from . import ADVISORY_LABEL

DETECTORS = ["D1", "D2", "D3", "D4", "D5", "D6"]


def fetch_verdicts(api: str, key: str | None = None) -> list[dict]:
    headers = {"X-API-Key": key} if key else {}
    events = httpx.get(f"{api}/telemetry", headers=headers, timeout=10).raise_for_status().json()
    return [e for e in events if e["kind"] == "verdict" and e["data"]["alerts"]]


def featurise(events: list[dict]) -> np.ndarray:
    """[5-minute units, QBER x 10, CHSH / 3, one-hot of fired detectors]: comparable scales for DBSCAN,
    so alerts of the same kind within a few minutes of each other fall into one incident."""
    rows = []
    for e in events:
        fired = {a["detector"] for a in e["data"]["alerts"]}
        rows.append([e["ts"] / 300.0, 10 * e["data"]["qber"], (e["data"].get("chsh") or 0.0) / 3,
                     *[1.0 if d in fired else 0.0 for d in DETECTORS]])
    return np.asarray(rows)


def _summary(members: list[dict]) -> dict:
    detectors = sorted({a["detector"] for e in members for a in e["data"]["alerts"]})
    return {
        "size": len(members),
        "event_seqs": [e["seq"] for e in members],
        "ledger_indices": [e["data"].get("ledger_index") for e in members],
        "links": sorted({e["data"].get("link", "?") for e in members}),
        "detectors": detectors,
        "critical": sum(any(a["severity"] == "critical" for a in e["data"]["alerts"]) for e in members),
        "fingerprints": sorted({e["data"].get("fingerprint", "") for e in members} - {"", "nominal"}),
        "first_ts": min(e["ts"] for e in members),
        "last_ts": max(e["ts"] for e in members),
        "mean_qber": float(np.mean([e["data"]["qber"] for e in members])),
    }


def cluster(events: list[dict], eps: float = 1.0) -> dict:
    if not events:
        return {"label": ADVISORY_LABEL, "incidents": [], "alerts": 0, "reduction": 0.0}
    labels = DBSCAN(eps=eps, min_samples=1).fit_predict(featurise(events))
    groups: dict[int, list[dict]] = {}
    for e, lab in zip(events, labels, strict=True):
        groups.setdefault(int(lab), []).append(e)
    incidents = [{"id": k, **_summary(v)} for k, v in groups.items()]
    incidents.sort(key=lambda i: i["last_ts"], reverse=True)
    return {"label": ADVISORY_LABEL, "alerts": len(events), "incidents": incidents,
            "reduction": 1 - len(incidents) / len(events)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default=os.getenv("QSENTINEL_API_URL", "http://localhost:8000"))
    ap.add_argument("--key", default=os.getenv("QSENTINEL_OPS_KEY"))
    a = ap.parse_args()
    print(cluster(fetch_verdicts(a.api, a.key)))
