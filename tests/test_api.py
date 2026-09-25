from fastapi.testclient import TestClient

from qsentinel.api.main import app

client = TestClient(app)


def test_sign_then_verify_roundtrip():
    sig = client.post("/sign", json={"message": "hello"}).json()
    v = client.post("/verify", json={"signature": sig}).json()
    assert v["decision"] == "ACCEPT"
    replay = client.post("/verify", json={"signature": sig}).json()
    assert replay["decision"] == "REJECT"


def test_attack_endpoint_and_ledger():
    r = client.post("/attacks/run", json={"attack": "intercept_resend", "seed": 5}).json()
    assert r["decision"] == "REJECT" and r["result"] == "PASS"
    assert client.get("/ledger/verify").json()["ok"]


def test_not_implemented_attack_returns_501():
    assert client.post("/attacks/run", json={"attack": "repudiation"}).status_code == 501
