import numpy as np
import pytest

from qsentinel.detect.fingerprint import fingerprint, pauli_vector, per_basis_counts
from qsentinel.quantum import ChannelModel, get_backend

N = 60_000


def _counts(channel, seed):
    rng = np.random.default_rng(seed)
    b, v = rng.integers(0, 3, N), rng.integers(0, 2, N)
    r = get_backend().teleport_and_measure(b, v, b, channel, seed)
    return per_basis_counts(b, r.outcomes != v)


@pytest.mark.parametrize("axis,key", [(0, "pZ"), (1, "pX"), (2, "pY")])
def test_single_basis_probe_recovers_pauli_axis(axis, key):
    p = pauli_vector(_counts(ChannelModel(intercept_fraction=0.2, eve_bases=(axis,)), 1))
    assert p[key] == pytest.approx(0.1, abs=0.01)          # f/2 on the probed axis
    assert sum(v for k, v in p.items() if k != key) < 0.01


def test_depolarising_is_isotropic():
    p = pauli_vector(_counts(ChannelModel(depolarizing=0.06), 2))
    assert all(v == pytest.approx(0.02, abs=0.005) for v in p.values())


def test_stealth_probe_flagged_and_attributed():
    base = _counts(ChannelModel(depolarizing=0.03), 3)
    cur = _counts(ChannelModel(depolarizing=0.03, intercept_fraction=0.04, eve_bases=(0,)), 4)
    fp = fingerprint(cur, base, alpha=1e-4, min_effect=0.005)
    assert fp.drift and "along Z" in fp.label
    assert fp.est_intercept_fraction == pytest.approx(0.04, abs=0.01)


def test_no_drift_on_same_channel():
    fp = fingerprint(_counts(ChannelModel(depolarizing=0.03), 5),
                     _counts(ChannelModel(depolarizing=0.03), 6), alpha=1e-4, min_effect=0.005)
    assert not fp.drift and fp.label == "nominal"


def test_random_basis_attack_is_isotropic_blind_spot():
    """Documented limitation: uniform-basis intercept looks like depolarising noise by shape."""
    fp = fingerprint(_counts(ChannelModel(intercept_fraction=0.3), 7), _counts(ChannelModel(), 8),
                     alpha=1e-4, min_effect=0.005)
    assert fp.drift and fp.label.startswith("isotropic")
