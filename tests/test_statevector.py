"""Exact state-vector engine (ported from the D1-D6 workstream) and its agreement with Stim."""

import math

import numpy as np
import pytest

from qsentinel.detect.calibrate import hoeffding_bound, hoeffding_threshold, wilson_interval
from qsentinel.detect.validate import false_alarm_validation
from qsentinel.quantum import ChannelModel, get_backend
from qsentinel.quantum import statevector as sv


def test_ideal_teleportation_is_perfect_for_random_states():
    rng = np.random.default_rng(0)
    for _ in range(100):
        psi = sv.state_from_bloch(math.acos(rng.uniform(-1, 1)), rng.uniform(0, 2 * math.pi))
        t = sv.teleport(psi, rng=rng)
        assert t.fidelity == pytest.approx(1.0, abs=1e-9)
        assert np.allclose(t.output_bloch, t.input_bloch, atol=1e-9)


@pytest.mark.parametrize("channel", [ChannelModel(), ChannelModel(depolarizing=0.2),
                                     ChannelModel(intercept_fraction=1.0), ChannelModel(entangle_fraction=0.7)])
def test_bsm_outcomes_are_exactly_uniform(channel):
    t = sv.teleport(sv.EIGENSTATES["+i"], channel, np.random.default_rng(1))
    assert all(p == pytest.approx(0.25) for p in t.bsm_probabilities.values())


def test_correction_undoes_the_bsm_pauli():
    rng = np.random.default_rng(3)
    seen = set()
    for _ in range(40):
        t = sv.teleport(sv.EIGENSTATES["-"], rng=rng)
        seen.add(t.correction)
        assert t.output_bloch == pytest.approx((-1.0, 0.0, 0.0), abs=1e-9)
    assert seen == {"I", "X", "Z", "XZ"}


@pytest.mark.parametrize("channel,expected", [
    (ChannelModel(intercept_fraction=1.0), 1 / 3),
    (ChannelModel(depolarizing=0.06), 0.04),
    (ChannelModel(entangle_fraction=0.5, entangle_basis=1), 1 / 6),
])
def test_exact_error_rate_matches_theory_and_stim(channel, expected):
    exact = sv.six_state_error_rate(channel)
    assert exact == pytest.approx(expected, abs=1e-9)
    rng = np.random.default_rng(5)
    b, v = rng.integers(0, 3, 30_000), rng.integers(0, 2, 30_000)
    r = get_backend("stim").teleport_and_measure(b, v, b, channel, seed=9)
    assert abs((r.outcomes != v).mean() - exact) < 0.012


def test_bsm_counts_uniformity_test():
    out = sv.bsm_counts(40_000, seed=4)
    assert sum(out["counts"].values()) == 40_000 and out["uniform"]


def test_qasm_has_the_protocol_steps():
    q = sv.qasm(1.0, 0.5)
    assert "cx q[1],q[2]" in q and "measure q[0] -> m[0]" in q and "u3(1.000000,0.500000,0)" in q


def test_hoeffding_and_wilson():
    assert hoeffding_bound(100, 0.1) == pytest.approx(math.exp(-2))
    assert hoeffding_threshold(128, 0.02, 1e-6) > 0.02
    lo, hi = wilson_interval(50, 1000)
    assert lo < 0.05 < hi


def test_false_alarm_rate_matches_exact_tail():
    rep = false_alarm_validation(64, 0.10, 0.04, trials=100_000, seed=1)
    assert rep["exact_inside_ci"]
    assert rep["far_exact"] <= rep["chernoff_bound"] <= rep["hoeffding_bound"]
