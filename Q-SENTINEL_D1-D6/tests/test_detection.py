from qsentinel.detect.models import DetectionEvidence
from qsentinel.detect.detector import run_all_detectors, overall_alert
from qsentinel.detect.replay import ReplayGuard


def honest_evidence():
    expected = (0, 1, 0, 1) * 16
    return DetectionEvidence(
        observed=expected,
        expected=expected,
        bases=("Z", "Z", "X", "X") * 16,
        verifier_id="v1",
        expected_verifier_id="v1",
        nonce="abc",
        nonce_already_used=False,
        basis_commitment="a" * 64,
        expected_basis_commitment="a" * 64,
        pair_ids=tuple(f"p{i}" for i in range(64)),
        expected_pair_ids=tuple(f"p{i}" for i in range(64)),
        bsm_counts={"00": 250, "01": 250, "10": 250, "11": 250},
        chsh_value=2.828,
        bell_fidelity=0.99,
    )


def test_honest_evidence_has_no_alerts():
    results = run_all_detectors(honest_evidence())
    assert not overall_alert(results)


def test_replay_guard():
    guard = ReplayGuard()
    assert guard.consume("n1")
    assert not guard.consume("n1")
