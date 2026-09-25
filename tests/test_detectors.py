"""Each detector against its known-attack fixture (dossier D4 acceptance criterion)."""

import pytest

from qsentinel.attacks import ATTACKS, run_attack
from qsentinel.config import FAST
from qsentinel.pipeline import QSentinel
from qsentinel.quantum import ChannelModel

RUNNABLE = [a for a in ATTACKS if a not in {"entangle_and_measure", "repudiation"}]


@pytest.mark.parametrize("attack", RUNNABLE)
def test_attack_caught_by_mapped_detector(attack):
    strength = 0.5 if attack == "known_basis_partial_forgery" else 1.0
    rep = run_attack(QSentinel(settings=FAST), attack, strength=strength, seed=11)
    assert rep.passed, rep.row()


def test_honest_accepted_on_noisy_channel():
    rep = run_attack(QSentinel(settings=FAST), "honest", seed=3,
                     channel=ChannelModel(depolarizing=0.03))
    assert rep.decision == "ACCEPT", rep.row()


def test_verdict_carries_proof_certificate():
    rep = run_attack(QSentinel(settings=FAST), "honest", seed=1)
    cert = rep.verdict["certificate"]
    assert cert["ai_in_trust_path"] is False
    assert cert["forgery_bound_per_block"] < 1e-4   # FAST profile (n=64); ~1e-16 at n=256
    assert len(cert["transcript_hash"]) == 64
