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
