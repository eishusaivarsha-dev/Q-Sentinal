import math

import numpy as np
import pytest

from qsentinel.attacks import run_attack
from qsentinel.config import DetectorConfig, ProtocolConfig, Settings
from qsentinel.pipeline import QSentinel
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


# --- QiskitAerBackend.bell_correlators (D3 input), contributed by Shubham Kumar ---------------

_BELL_CHANNELS = {
    "honest": ChannelModel(),
    "depolarizing": ChannelModel(depolarizing=0.08),
    "intercept-all": ChannelModel(intercept_fraction=1.0),
    "intercept-half-two-basis": ChannelModel(intercept_fraction=0.5, eve_bases=(0, 1)),
    "entangle-probe": ChannelModel(entangle_fraction=1.0, entangle_basis=1),
    "mixed": ChannelModel(depolarizing=0.05, intercept_fraction=0.3, entangle_fraction=0.3,
                          entangle_basis=2),
}


def test_qiskit_chsh_honest_vs_attacked():
    pytest.importorskip("qiskit_aer")
    be = get_backend("qiskit")
    c = be.bell_correlators(6000, ChannelModel(), seed=1)
    assert math.sqrt(2) * (c["ZZ"] + c["XX"]) == pytest.approx(2 * math.sqrt(2))
    assert c["YY"] == pytest.approx(-1.0)          # |Phi+> is anti-correlated in Y
    c = be.bell_correlators(6000, ChannelModel(intercept_fraction=1.0), seed=1)
    assert math.sqrt(2) * (c["ZZ"] + c["XX"]) < 2


@pytest.mark.parametrize("channel", _BELL_CHANNELS.values(), ids=_BELL_CHANNELS.keys())
def test_qiskit_bell_correlators_agree_with_stim(channel):
    """Two independent simulators, same attack schedule: correlators must agree to sampling noise."""
    pytest.importorskip("qiskit_aer")
    n = 12_000
    stim_c = get_backend("stim").bell_correlators(n, channel, seed=11)
    aer_c = get_backend("qiskit").bell_correlators(n, channel, seed=11)
    for name in ("ZZ", "XX", "YY"):
        assert abs(stim_c[name] - aer_c[name]) < 0.08, (name, stim_c, aer_c)


def test_qiskit_bell_correlators_reproducible_from_seed():
    pytest.importorskip("qiskit_aer")
    be = get_backend("qiskit")
    ch = ChannelModel(depolarizing=0.05, intercept_fraction=0.4)
    assert be.bell_correlators(2000, ch, seed=5) == be.bell_correlators(2000, ch, seed=5)


def test_qiskit_backend_runs_full_verification_with_d3():
    """Before bell_correlators existed, commissioning on Aer raised NotImplementedError."""
    pytest.importorskip("qiskit_aer")
    cfg = Settings(protocol=ProtocolConfig(rounds_per_bit=32, hash_bits=16),
                   detectors=DetectorConfig(commission_rounds=1500, commission_pairs=1500,
                                            bell_test_pairs=1200))
    rep = run_attack(QSentinel(settings=cfg, backend=get_backend("qiskit")), "honest", seed=1)
    d3 = next(r for r in rep.verdict["results"] if r["detector"] == "D3")
    assert rep.decision == "ACCEPT" and not rep.detectors_fired, rep.row()
    assert not d3["alert"]
