import pytest

from qsentinel.attacks import run_attack
from qsentinel.config import FAST
from qsentinel.ledger import HashChainLedger, audit, rebuild_freshness
from qsentinel.ledger.commit_reveal import commitment, joint_seed, verify_reveal
from qsentinel.ledger.merkle import inclusion_proof, merkle_root, verify_inclusion
from qsentinel.pipeline import QSentinel


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


@pytest.mark.parametrize("size", range(1, 18))
def test_merkle_proofs_for_every_leaf(size):
    leaves = [bytes([i]) * 32 for i in range(size)]
    root = merkle_root(leaves)
    for i, leaf in enumerate(leaves):
        assert verify_inclusion(leaf, inclusion_proof(i, leaves), root)
    assert not verify_inclusion(b"\xff" * 32, inclusion_proof(0, leaves), root)


def test_pipeline_anchors_and_proves_verdicts():
    env = QSentinel(settings=FAST)
    for s in range(FAST.ledger.merkle_batch):
        run_attack(env, "honest", seed=s)
    first_verdict = env.ledger.by_kind("verdict")[0].index
    proof = env.ledger.inclusion_proof(first_verdict)
    assert proof is not None and HashChainLedger.check_proof(proof)
    assert audit(env.ledger)["ok"]


def test_replay_protection_survives_restart(tmp_path):
    p = tmp_path / "ledger.jsonl"
    env = QSentinel(settings=FAST, ledger=HashChainLedger(path=p))
    env.register_signer("alice")
    env.register_verifier("bob")
    sig = env.sign("alice", b"hello", seed=1)
    assert env.verify(sig, "bob", seed=2).decision == "ACCEPT"
    # "restart": new process state, same ledger file
    env2 = QSentinel(settings=FAST, ledger=HashChainLedger(signer=env.ledger.signer, path=p))
    env2.register_signer("alice")
    env2.register_verifier("bob")
    env2._pubkeys, env2.identities = env._pubkeys, env.identities   # key directory persists too
    v = env2.verify(sig, "bob", seed=3)
    assert v.decision == "REJECT" and "D5" in [r.detector for r in v.alerts]
    assert rebuild_freshness(env2.ledger).seen


def test_commit_reveal():
    c = commitment("k1", "bob", b"s" * 32, b"salt")
    assert verify_reveal("k1", "bob", b"s" * 32, b"salt", c)
    assert not verify_reveal("k1", "bob", b"t" * 32, b"salt", c)
    assert joint_seed("k1", {"a": b"1", "b": b"2"}) == joint_seed("k1", {"b": b"2", "a": b"1"})


def test_audit_flags_repudiation_without_symmetrisation():
    env = QSentinel(settings=FAST)
    rep = run_attack(env, "repudiation_unprotected", seed=4)
    assert rep.metrics["violation"] is True
    assert audit(env.ledger)["disputes"]


def test_symmetrisation_keeps_verifiers_consistent_and_reveals_check_out():
    for seed in range(5):
        env = QSentinel(settings=FAST)
        rep = run_attack(env, "repudiation", seed=seed)
        assert not rep.metrics["violation"], rep.row()
        sym = audit(env.ledger)["symmetrisation"]
        assert sym["revealed"] >= 1 and not sym["problems"]
