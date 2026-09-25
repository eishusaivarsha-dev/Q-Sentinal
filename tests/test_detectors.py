"""Each detector against its known-attack fixture (dossier D4 acceptance criterion)."""

import pytest

from qsentinel.attacks import ATTACKS, run_attack
from qsentinel.config import FAST
from qsentinel.pipeline import QSentinel
from qsentinel.quantum import ChannelModel


@pytest.mark.parametrize("attack", list(ATTACKS))
def test_attack_caught_by_mapped_detector(attack):
    rep = run_attack(QSentinel(settings=FAST), attack, seed=11)
    assert rep.passed, rep.row()


@pytest.mark.parametrize("seed", range(5))
def test_honest_noisy_channel_accepted_without_false_alarms(seed):
    rep = run_attack(QSentinel(settings=FAST), "honest", seed=seed,
                     channel=ChannelModel(depolarizing=0.03))
    assert rep.decision == "ACCEPT" and not rep.detectors_fired, rep.row()


def test_verdict_carries_proof_certificate():
    rep = run_attack(QSentinel(settings=FAST), "honest", seed=1)
    cert = rep.verdict["certificate"]
    assert cert["ai_in_trust_path"] is False
    assert cert["forgery_exact_per_block"] <= cert["forgery_bound_per_block"] < 1e-4
    assert len(cert["transcript_hash"]) == 64
    assert cert["channel_fingerprint"] == "nominal"


def test_stolen_key_signature_is_physically_valid_but_caught_by_honeypot():
    rep = run_attack(QSentinel(settings=FAST), "stolen_key_honeypot", seed=2)
    d2 = next(r for r in rep.verdict["results"] if r["detector"] == "D2")
    assert not d2["alert"] and rep.decision == "REJECT" and "D6" in rep.detectors_fired


def test_cusum_raises_channel_alarm_over_repeated_stealth_verifications():
    env = QSentinel(settings=FAST)
    fired = []
    for s in range(6):
        rep = run_attack(env, "stealth_probe", strength=0.04, seed=100 + s)
        fired.append(next(r for r in rep.verdict["results"] if r["detector"] == "D4")["extra"]["cusum_alarm"])
    assert any(fired)
    assert env.monitor.state("alice->bob").cusum_alarms >= 1


def test_baseline_is_frozen_and_on_ledger():
    env = QSentinel(settings=FAST)
    run_attack(env, "honest", seed=1)
    base = env.monitor.state("alice->bob").baseline
    run_attack(env, "stealth_probe", strength=0.2, seed=2)
    assert env.monitor.state("alice->bob").baseline is base          # never adapted by traffic
    assert [e for e in env.ledger.entries if e.kind == "link_commissioned"]
