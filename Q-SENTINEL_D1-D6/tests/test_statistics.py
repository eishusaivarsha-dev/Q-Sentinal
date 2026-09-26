from qsentinel.statistics import (
    calibrate,
    chernoff_bound,
    chi_square_uniformity,
    hoeffding_bound,
    sprt,
    validate_false_alarm_rate,
)


def test_hoeffding_decreases_with_n():
    assert hoeffding_bound(1000, 0.1) < hoeffding_bound(100, 0.1)


def test_chernoff_is_valid_number():
    value = chernoff_bound(128, 0.25, 0.01)
    assert 0 <= value <= 1


def test_uniform_chi_square_is_not_rejected_for_balanced_counts():
    result = chi_square_uniformity({"00": 250, "01": 250, "10": 250, "11": 250})
    assert result["p_value"] > 0.05


def test_sprt_eventually_detects_attack_sequence():
    result = sprt([1] * 30, p0=0.01, p1=0.2, alpha=0.01, beta=0.01)
    assert result.decision == "H1_ATTACK"


def test_calibration_returns_conservative_integer_threshold():
    t = calibrate(128, baseline_mismatch=0.05, target_far=0.01, target_frr=0.01)
    assert 0 < t.mismatch_rate_threshold <= 1
    assert 0 < t.mismatch_count_threshold <= 128
    assert t.exact_far_at_count <= t.hoeffding_upper_bound_at_count


def test_empirical_far_validation_is_reproducible_and_tight():
    r = validate_false_alarm_rate(n=128, baseline_rate=0.05, threshold_count=13, trials=100_000, seed=2026)
    assert r.within_ten_percent
    assert r.empirical_far <= r.hoeffding_bound
