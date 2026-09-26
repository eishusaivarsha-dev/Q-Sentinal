import numpy as np

from qsentinel.attacks.base import AttackScenario
from qsentinel.attacks.runner import run_campaign, validate_reproducibility, run_from_config
from qsentinel.detect.detector import run_all_detectors
from qsentinel.detect.models import DetectionEvidence
from qsentinel.qds.keygen import generate_keypair, distribute_public_key
from qsentinel.qds.signer import sign
from qsentinel.qds.verifier import verify
from qsentinel.quantum.backends import IdealBackend
from qsentinel.statistics.calibration import validate_false_alarm_rate


def make_base():
    private, verifier = generate_keypair(rounds=64, seed=77)
    public = distribute_public_key(private, backend=IdealBackend())
    signature = sign("Q-SENTINEL", private, public, nonce="acceptance-base")
    return private, verifier, public, AttackScenario(
        name="base",
        description="honest baseline",
        public_key=public,
        signature=signature,
        verifier_key=verifier,
        chsh_value=2.828,
        bell_fidelity=0.99,
        bsm_counts={"00": 256, "01": 256, "10": 256, "11": 256},
    )


def test_d3_10000_honest_signatures_zero_frr():
    private, verifier, public, _ = make_base()
    rng = np.random.default_rng(123)
    accepted = 0
    for i in range(10_000):
        signature = sign("honest", private, public, nonce=f"n-{i}")
        accepted += int(verify("honest", signature, public, verifier, rng=rng).accepted)
    assert accepted == 10_000


def test_all_six_detectors_can_fire_on_fixtures():
    private, verifier, public, _ = make_base()
    e = tuple(verifier.expected_outcomes)
    base_kwargs = dict(
        expected=e,
        bases=verifier.bases,
        expected_verifier_id=verifier.verifier_id,
        nonce="x",
        nonce_already_used=False,
        basis_commitment=verifier.basis_commitment,
        expected_basis_commitment=verifier.basis_commitment,
        pair_ids=verifier.pair_ids,
        expected_pair_ids=verifier.pair_ids,
        bsm_counts={"00": 250, "01": 250, "10": 250, "11": 250},
        chsh_value=2.828,
        bell_fidelity=0.99,
    )
    fixtures = {
        "D1": DetectionEvidence(observed=tuple([1 - x if i == 0 else x for i, x in enumerate(e)]), verifier_id=verifier.verifier_id, message_digest_ok=True, **base_kwargs),
        "D2": DetectionEvidence(observed=tuple([1 - x for x in e]), verifier_id=verifier.verifier_id, message_digest_ok=True, **base_kwargs),
        "D3": DetectionEvidence(observed=e, verifier_id=verifier.verifier_id, message_digest_ok=True, **{**base_kwargs, "chsh_value": 1.8, "bell_fidelity": 0.7}),
        "D4": DetectionEvidence(observed=tuple([1 - x if i < 40 else x for i, x in enumerate(e)]), verifier_id=verifier.verifier_id, message_digest_ok=True, **{**base_kwargs, "bsm_counts": {"00": 900, "01": 100, "10": 100, "11": 100}}),
        "D5": DetectionEvidence(observed=e, verifier_id=verifier.verifier_id, message_digest_ok=True, **{**base_kwargs, "nonce_already_used": True}),
        "D6": DetectionEvidence(observed=e, verifier_id="attacker", message_digest_ok=True, **{**base_kwargs, "basis_commitment": "0"*64}),
    }
    assert all(run_all_detectors(ev)[name].detected for name, ev in fixtures.items())


def test_d5_100k_empirical_far_is_within_ten_percent_of_exact_tail():
    report = validate_false_alarm_rate(
        n=128,
        baseline_rate=0.05,
        threshold_count=13,
        trials=100_000,
        seed=2026,
    )
    assert report.within_ten_percent
    assert report.empirical_far <= report.hoeffding_bound


def test_d6_all_attacks_and_bit_for_bit_reproducibility():
    _, _, _, base = make_base()
    results = run_campaign(base, seed=2026, strength=1.0)
    assert len(results) == 7
    assert all(r["mapped_detector_detected"] for r in results)
    assert validate_reproducibility(base, seed=2026, strength=1.0)


def test_d6_yaml_campaign_configs_exist_and_load():
    from pathlib import Path
    _, _, _, base = make_base()
    root = Path(__file__).resolve().parents[1]
    cfgs = sorted((root / "configs" / "attacks").glob("*.yaml"))
    assert len(cfgs) == 7
    results = [run_from_config(base, path) for path in cfgs]
    assert all(r["overall_alert"] for r in results)
