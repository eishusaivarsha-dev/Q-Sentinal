from qsentinel.ledger import HashChainLedger


def test_chain_verifies_and_detects_tampering():
    led = HashChainLedger()
    for i in range(3):
        led.append("verdict", {"decision": "ACCEPT", "i": i})
    assert led.verify_chain()[0]
    led.entries[1].payload["decision"] = "REJECT"
    ok, msg = led.verify_chain()
    assert not ok and "entry 1" in msg


def test_ledger_persists(tmp_path):
    p = tmp_path / "ledger.jsonl"
    led = HashChainLedger(path=p)
    led.append("verdict", {"x": 1})
    again = HashChainLedger(signer=led.signer, path=p)
    assert len(again.entries) == 1 and again.verify_chain()[0]
