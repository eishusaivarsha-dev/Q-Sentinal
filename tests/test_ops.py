"""Advisory ops plane (ops/): clustering + narration + HTTP service. Skipped unless `pip install -e ops`."""

import pytest

pytest.importorskip("sklearn")
pytest.importorskip("qsentinel_ops")

from fastapi.testclient import TestClient  # noqa: E402
from qsentinel_ops import ADVISORY_LABEL, server  # noqa: E402
from qsentinel_ops.clustering import cluster  # noqa: E402

from qsentinel.api.main import app as core_app  # noqa: E402


def _live_events():
    core = TestClient(core_app)
    for i in range(3):
        core.post("/attacks/run", json={"attack": "intercept_resend", "seed": 100 + i})
    core.post("/attacks/run", json={"attack": "stolen_key_honeypot", "seed": 7})
    return [e for e in core.get("/telemetry").json() if e["kind"] == "verdict" and e["data"]["alerts"]]


def test_clustering_groups_alerts_into_fewer_incidents():
    events = _live_events()
    result = cluster(events)
    assert result["label"] == ADVISORY_LABEL
    assert 1 <= len(result["incidents"]) < len(events)
    assert sum(i["size"] for i in result["incidents"]) == len(events)


def test_ops_service_returns_labelled_narratives(monkeypatch):
    events = _live_events()
    monkeypatch.setattr(server, "fetch_verdicts", lambda api, key=None: events)
    body = TestClient(server.app).get("/incidents").json()
    assert body["incidents"]
    assert all(i["narrative"].startswith(f"[{ADVISORY_LABEL}]") for i in body["incidents"])
