from fastapi.testclient import TestClient

from qsentinel.api.main import app

client = TestClient(app)


def test_verdict_store_overview_and_links_follow_a_verification():
    sig = client.post("/sign", json={"message": "dashboard"}).json()
    v = client.post("/verify", json={"signature": sig}).json()
    idx = v["certificate"]["ledger_index"]
    assert client.get(f"/verdicts/{idx}").json()["decision"] == v["decision"]
    assert client.get("/verdicts?limit=5").json()[0]["ledger_index"] == idx
    assert client.get("/verdicts/999999").status_code == 404
    ov = client.get("/overview").json()
    assert ov["verdicts"]["total"] >= 1 and ov["ledger"]["chain_ok"]
    link = client.get("/links").json()["alice->bob"]
    assert link["latest"]["ledger_index"] == idx and link["status"] in {"healthy", "warning", "critical"}
    assert set(link["latest"]["rates"]) == {"Z", "X", "Y"}


def test_telemetry_streams_verdicts_and_ledger_entries():
    kinds = {e["kind"] for e in client.get("/telemetry").json()}
    assert {"verdict", "ledger_entry", "key_issued"} <= kinds
    last_verdict = [e for e in client.get("/telemetry").json() if e["kind"] == "verdict"][-1]
    assert "ledger_index" in last_verdict["data"] and "rates" in last_verdict["data"]


def test_single_basis_probe_via_verify_endpoint():
    sig = client.post("/sign", json={"message": "probe"}).json()
    channel = {"intercept_fraction": 0.2, "eve_bases": [0]}
    v = client.post("/verify", json={"signature": sig, "channel": channel}).json()
    d4 = next(r for r in v["results"] if r["detector"] == "D4")
    assert "along Z" in d4["extra"]["fingerprint"]["label"]
    bad = client.post("/verify", json={"signature": sig, "channel": {"eve_bases": [7]}})
    assert bad.status_code == 422


def test_sweep_endpoint_returns_rows():
    rows = client.post("/sweeps", json={"attack": "intercept_resend", "steps": 3, "trials": 2}).json()
    assert [r["strength"] for r in rows] == [0.0, 0.5, 1.0]
    assert rows[0]["reject_rate"] == 0.0 and rows[-1]["reject_rate"] == 1.0


def test_repudiation_metrics_expose_both_verifiers():
    r = client.post("/attacks/run", json={"attack": "repudiation_unprotected", "seed": 2}).json()
    assert r["metrics"]["bob"] == "ACCEPT" and r["metrics"]["charlie"] == "REJECT"


def test_sign_then_verify_roundtrip():
    sig = client.post("/sign", json={"message": "hello"}).json()
    v = client.post("/verify", json={"signature": sig}).json()
    assert v["decision"] == "ACCEPT"
    replay = client.post("/verify", json={"signature": sig}).json()
    assert replay["decision"] == "REJECT"


def test_attack_endpoint_ledger_and_audit():
    r = client.post("/attacks/run", json={"attack": "intercept_resend", "seed": 5}).json()
    assert r["decision"] == "REJECT" and r["result"] == "PASS"
    assert client.get("/ledger/verify").json()["ok"]
    assert "disputes" in client.get("/ledger/audit").json()


def test_anchor_and_public_proof():
    client.post("/attacks/run", json={"attack": "honest", "seed": 1})
    client.post("/ledger/anchor")
    verdict = next(e for e in reversed(client.get("/ledger").json()) if e["kind"] == "verdict")
    proof = client.get(f"/ledger/proof/{verdict['index']}").json()
    assert proof["valid"]


def test_rbac(monkeypatch):
    monkeypatch.setenv("QSENTINEL_API_KEYS",
                       "ka=alice:signer,kb=bob:verifier,ks=soc:analyst,km=mallory:verifier")
    assert client.post("/sign", json={"message": "x"}).status_code == 401
    assert client.post("/sign", json={"message": "x"}, headers={"X-API-Key": "kb"}).status_code == 403
    sig = client.post("/sign", json={"message": "x"}, headers={"X-API-Key": "ka"}).json()
    # alice cannot sign as someone else
    assert client.post("/sign", json={"signer_id": "bob", "message": "x"},
                       headers={"X-API-Key": "ka"}).status_code == 403
    # mallory is a verifier but cannot claim to be bob
    assert client.post("/verify", json={"signature": sig, "verifier_id": "bob"},
                       headers={"X-API-Key": "km"}).status_code == 403
    ok = client.post("/verify", json={"signature": sig}, headers={"X-API-Key": "kb"}).json()
    assert ok["decision"] == "ACCEPT"
    assert client.get("/ledger/audit", headers={"X-API-Key": "ka"}).status_code == 403
    assert client.get("/ledger/audit", headers={"X-API-Key": "ks"}).status_code == 200
    assert client.post("/attacks/run", json={"attack": "honest"},
                       headers={"X-API-Key": "ks"}).status_code == 403


def test_quantum_lab_endpoints():
    t = client.post("/quantum/teleport", json={"state": "+i", "channel": {"intercept_fraction": 1.0}}).json()
    assert abs(t["fidelity"] - 2 / 3) < 1e-9 and t["correction"] in {"I", "X", "Z", "XZ"} and "OPENQASM" in t["qasm"]
    assert client.post("/quantum/teleport", json={"state": "bogus"}).status_code == 422
    b = client.post("/quantum/bsm", json={"shots": 2000, "seed": 1}).json()
    assert sum(b["counts"].values()) == 2000


def test_far_and_acceptance_report():
    far = client.get("/calibration/far?n=64&tau=0.1&noise=0.04&trials=20000").json()
    assert far["limit"] == 6 and 0 < far["far_exact"] < 0.05
    rep = client.get("/report/acceptance").json()
    assert rep["passed"] and [c["id"] for c in rep["checks"]][:6] == ["D1", "D2", "D3", "D4", "D5", "D6"]


def test_analyst_review_is_chained_on_the_ledger_and_never_changes_the_verdict():
    run = client.post("/attacks/run", json={"attack": "replay", "seed": 11}).json()
    idx = run["verdict"]["certificate"]["ledger_index"]
    r = client.post(f"/reviews/{idx}", json={"decision": "confirm_fraud", "note": "replay from client 7",
                                             "advisory": {"risk": 75, "level": "critical", "category": "Replay",
                                                          "recommendation": "escalate"}})
    assert r.status_code == 200
    body = r.json()
    assert body["verdict_decision"] == run["decision"] and body["agreed_with_ai"] is False
    assert body["advisory"]["label"].startswith("ADVISORY")
    assert client.get(f"/reviews?verdict_index={idx}").json()[-1]["decision"] == "confirm_fraud"
    assert client.get("/ledger?kind=analyst_review").json()[-1]["index"] == body["index"]
    assert client.get("/ledger/verify").json()["ok"]
    assert client.post("/reviews/999999", json={"decision": "dismiss"}).status_code == 404
    assert client.post(f"/reviews/{idx}", json={"decision": "approve_payment"}).status_code == 422
