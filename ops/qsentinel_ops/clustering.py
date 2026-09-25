"""Alert-storm clustering: collapse many correlated alerts into a few incidents (target: >= 60%
alert-volume reduction, dossier D12).

    python -m qsentinel_ops.clustering --api http://localhost:8000
"""

from __future__ import annotations

import argparse

import httpx
import numpy as np
from sklearn.cluster import DBSCAN

from . import ADVISORY_LABEL

DETECTORS = ["D1", "D2", "D3", "D4", "D5", "D6"]


def fetch_verdicts(api: str) -> list[dict]:
    events = httpx.get(f"{api}/telemetry", timeout=10).json()
    return [e for e in events if e["kind"] == "verdict" and e["data"]["alerts"]]


def featurise(events: list[dict]) -> np.ndarray:
    """[time, qber, chsh, one-hot of fired detectors]. TODO: scale + add verifier id."""
    rows = []
    for e in events:
        fired = {a["detector"] for a in e["data"]["alerts"]}
        rows.append([e["ts"] / 60.0, e["data"]["qber"], e["data"].get("chsh") or 0.0,
                     *[1.0 if d in fired else 0.0 for d in DETECTORS]])
    return np.asarray(rows)


def cluster(events: list[dict], eps: float = 1.0) -> dict:
    if not events:
        return {"label": ADVISORY_LABEL, "incidents": [], "alerts": 0}
    labels = DBSCAN(eps=eps, min_samples=1).fit_predict(featurise(events))
    incidents = {}
    for e, lab in zip(events, labels, strict=True):
        incidents.setdefault(int(lab), []).append(e["seq"])
    return {"label": ADVISORY_LABEL, "alerts": len(events),
            "incidents": [{"id": k, "event_seqs": v} for k, v in incidents.items()]}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://localhost:8000")
    print(cluster(fetch_verdicts(ap.parse_args().api)))
