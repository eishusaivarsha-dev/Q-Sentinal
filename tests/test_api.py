from fastapi.testclient import TestClient

from qsentinel.api.main import app

client = TestClient(app)


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
