"""Advisory ops plane (ops/): clustering + narration + HTTP service. Skipped unless `pip install -e ops`."""

import pytest

pytest.importorskip("sklearn")
pytest.importorskip("qsentinel_ops")

import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from qsentinel_ops import ADVISORY_LABEL, copilot, server  # noqa: E402
from qsentinel_ops.anomaly import rank  # noqa: E402
from qsentinel_ops.clustering import cluster  # noqa: E402
from qsentinel_ops.forecast import forecast_link, holt  # noqa: E402

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


def test_holt_forecast_projects_a_rising_error_rate():
    f = holt([0.01, 0.02, 0.03, 0.04, 0.05], horizon=5)
    assert f["trend"] > 0 and f["forecast"][-1] > 0.05
    link = {"status": "healthy", "history": [{"qber": q, "chsh": 2.8 - 5 * q} for q in (0.01, 0.03, 0.05, 0.07, 0.09)]}
    out = forecast_link("a->b", link)
    assert out["risk"] in {"elevated", "high"} and out["steps_to_breach"] is not None


def test_anomaly_ranking_flags_the_attacked_verification():
    core = TestClient(core_app)
    for i in range(10):
        core.post("/attacks/run", json={"attack": "honest", "seed": 300 + i})
    core.post("/attacks/run", json={"attack": "intercept_resend", "seed": 5})
    events = [e for e in core.get("/telemetry").json() if e["kind"] == "verdict"]
    top = rank(events)["anomalies"][0]
    assert top["decision"] == "REJECT" and top["drivers"]


def _patched_core(monkeypatch):
    core = TestClient(core_app)
    for i in range(3):
        core.post("/attacks/run", json={"attack": "honest", "seed": 500 + i})
    core.post("/attacks/run", json={"attack": "stolen_key_honeypot", "seed": 8})
    monkeypatch.setattr(httpx, "get", lambda url, headers=None, timeout=None:
                        core.get(url.replace(server.API, ""), headers=headers or {}))
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    return core


def test_copilot_offline_answers_from_the_brief(monkeypatch):
    core = _patched_core(monkeypatch)
    idx = core.get("/verdicts?limit=1").json()[0]["ledger_index"]
    brief = copilot.build_brief(server.API, None, f"explain #{idx}")
    text = copilot.offline_answer(f"What happened in #{idx} and what should I do?", brief)
    assert f"#{idx}" in text and "D6" in text and "Suggested next steps" in text
    assert "D4 · Channel forensics" in copilot.offline_answer("what does D4 do?", brief)


def test_copilot_chat_streams_server_sent_events(monkeypatch):
    _patched_core(monkeypatch)
    ops = TestClient(server.app)
    assert ops.get("/copilot/status").json()["mode"] == "offline"
    r = ops.post("/copilot/chat", json={"question": "status?"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/event-stream")
    events = [line for line in r.text.splitlines() if line.startswith("event: ")]
    assert events[0] == "event: meta" and events[-1] == "event: done" and "event: delta" in events
    assert ops.post("/copilot/chat", json={"question": ""}).status_code == 422


def test_fraud_queue_flags_the_stolen_key_and_leaves_the_decision_to_the_analyst(monkeypatch):
    core = _patched_core(monkeypatch)
    ops = TestClient(server.app)
    q = ops.get("/fraud/queue").json()
    assert q["label"] == ADVISORY_LABEL and q["cases"]
    top = q["cases"][0]
    assert top["category"] == "Stolen keystore" and top["level"] == "critical"
    assert top["recommendation"] == "confirm_fraud" and top["review"] is None and top["reasons"]
    # honest traffic is not in the queue
    assert all(c["decision"] == "REJECT" or c["risk"] >= 25 for c in q["cases"])

    # The analyst disagrees with the AI; the kernel records the human decision on the ledger.
    r = core.post(f"/reviews/{top['ledger_index']}", json={
        "decision": "escalate", "note": "check with the key custodian first",
        "advisory": {k: top[k] for k in ("risk", "level", "category", "recommendation")}})
    assert r.status_code == 200 and r.json()["agreed_with_ai"] is False
    case = ops.get(f"/fraud/cases/{top['ledger_index']}").json()
    assert case["review"]["decision"] == "escalate"
    assert core.get(f"/verdicts/{top['ledger_index']}").json()["decision"] == top["decision"]   # verdict untouched
    brief = copilot.build_brief(server.API, None, "any fraud?")
    assert "decided by analyst: escalate" in copilot.offline_answer("any fraud in the queue?", brief)
