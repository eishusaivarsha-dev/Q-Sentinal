from qsentinel.attacks.base import AttackScenario
from qsentinel.attacks.runner import run_campaign
from qsentinel.qds.keygen import generate_keypair, distribute_public_key
from qsentinel.qds.signer import sign


def make_base():
    private, verifier = generate_keypair(rounds=64, seed=10)
    public = distribute_public_key(private)
    signature = sign("Q-SENTINEL", private, public, nonce="demo-nonce")
    return AttackScenario(
        name="base",
        description="honest baseline",
        public_key=public,
        signature=signature,
        verifier_key=verifier,
        bsm_counts={"00": 250, "01": 250, "10": 250, "11": 250},
    )


def test_all_seven_attacks_run():
    results = run_campaign(make_base(), seed=2026, strength=1.0)
    assert len(results) == 7
    assert {item["attack"] for item in results} == {
        "blind_forgery",
        "known_basis_partial_forgery",
        "intercept_resend",
        "entangle_and_measure",
        "replay",
        "mitm_classical",
        "repudiation",
    }
    assert all(item["overall_alert"] for item in results)
