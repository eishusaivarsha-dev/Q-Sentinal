"""Direct (rotated-setting) CHSH test vs the stabilizer-derived value used by D3. Author: Shubham Kumar."""

import math

import pytest

from qsentinel.quantum import ChannelModel, get_backend

pytest.importorskip("qiskit_aer")
from qsentinel.quantum.chsh_direct import CLASSICAL_BOUND, TSIRELSON_BOUND, chsh_direct  # noqa: E402

CHANNELS = {
    "honest": ChannelModel(),
    "depolarizing": ChannelModel(depolarizing=0.08),
    "intercept-all": ChannelModel(intercept_fraction=1.0),
    "intercept-half-two-basis": ChannelModel(intercept_fraction=0.5, eve_bases=(0, 1)),
    "entangle-probe": ChannelModel(entangle_fraction=1.0, entangle_basis=1),
    "mixed": ChannelModel(depolarizing=0.05, intercept_fraction=0.3, entangle_fraction=0.3,
                          entangle_basis=2),
}


def test_honest_pair_reaches_tsirelson_bound():
    r = chsh_direct(12_000, ChannelModel(), seed=1)
    assert r["S"] == pytest.approx(TSIRELSON_BOUND, abs=0.08)
    assert sum(r["pairs_per_setting"].values()) == 12_000


def test_intercept_resend_falls_below_classical_bound():
    assert chsh_direct(12_000, ChannelModel(intercept_fraction=1.0), seed=1)["S"] < CLASSICAL_BOUND


@pytest.mark.parametrize("channel", CHANNELS.values(), ids=CHANNELS.keys())
def test_direct_chsh_matches_stabilizer_derived_value(channel):
    """For |Phi+> under Pauli channels, S = sqrt(2) * (<ZZ> + <XX>) exactly, so the two must agree."""
    c = get_backend("stim").bell_correlators(20_000, channel, seed=3)
    derived = math.sqrt(2) * (c["ZZ"] + c["XX"])
    assert abs(chsh_direct(20_000, channel, seed=3)["S"] - derived) < 0.15


def test_reproducible_from_seed():
    ch = ChannelModel(depolarizing=0.05, intercept_fraction=0.3)
    assert chsh_direct(2000, ch, seed=9) == chsh_direct(2000, ch, seed=9)
