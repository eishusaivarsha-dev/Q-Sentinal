import math

import numpy as np
import pytest

from qsentinel.quantum import ChannelModel, get_backend

N = 20_000


@pytest.fixture
def rounds():
    rng = np.random.default_rng(0)
    return rng.integers(0, 3, N), rng.integers(0, 2, N)


def test_teleportation_is_deterministic_on_ideal_channel(rounds):
    b, v = rounds
    r = get_backend("stim").teleport_and_measure(b, v, b, ChannelModel(), seed=1)
    assert (r.outcomes == v).all()


def test_bsm_outcomes_uniform(rounds):
    b, v = rounds
    r = get_backend("stim").teleport_and_measure(b, v, b, ChannelModel(), seed=1)
    freq = np.bincount(r.bsm[:, 0] * 2 + r.bsm[:, 1], minlength=4) / N
    assert np.allclose(freq, 0.25, atol=0.02)


def test_reproducible_from_seed(rounds):
    b, v = rounds
    be = get_backend("stim")
    r1 = be.teleport_and_measure(b, v, b, ChannelModel(intercept_fraction=0.5), seed=7)
    r2 = be.teleport_and_measure(b, v, b, ChannelModel(intercept_fraction=0.5), seed=7)
    assert (r1.outcomes == r2.outcomes).all() and (r1.bsm == r2.bsm).all()


@pytest.mark.parametrize("eve_bases,expected", [((0, 1, 2), 1 / 3), ((0, 1), 1 / 4)])
def test_intercept_resend_qber(eve_bases, expected):
    rng = np.random.default_rng(1)
    b = rng.integers(0, len(eve_bases), N)
    v = rng.integers(0, 2, N)
    r = get_backend("stim").teleport_and_measure(
        b, v, b, ChannelModel(intercept_fraction=1.0, eve_bases=eve_bases), seed=3)
    assert abs((r.outcomes != v).mean() - expected) < 0.02


def test_chsh_honest_vs_attacked():
    be = get_backend("stim")
    c = be.bell_correlators(6000, ChannelModel(), seed=1)
    assert math.sqrt(2) * (c["ZZ"] + c["XX"]) == pytest.approx(2 * math.sqrt(2))
    c = be.bell_correlators(6000, ChannelModel(intercept_fraction=1.0), seed=1)
    assert math.sqrt(2) * (c["ZZ"] + c["XX"]) < 2


def test_qiskit_backend_agrees_with_stim():
    pytest.importorskip("qiskit_aer")
    rng = np.random.default_rng(2)
    b, v = rng.integers(0, 3, 40), rng.integers(0, 2, 40)
    r = get_backend("qiskit").teleport_and_measure(b, v, b, ChannelModel(), seed=1)
    assert (r.outcomes == v).all()
