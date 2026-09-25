import numpy as np
import pytest

from qsentinel.detect.calibrate import forgery_bound, rounds_needed, tradeoff_table
from qsentinel.detect.sequential import bernoulli_sprt


def test_dossier_headline_bound():
    assert forgery_bound(128, 0.0, 0.25) == pytest.approx(1.02e-16, rel=0.01)


def test_tradeoff_table_matches_docs():
    rows = {r["tau"]: r for r in tradeoff_table()}
    assert rows[0.10]["two_basis_n"] == 509
    assert rows[0.10]["six_state_n"] == 247


def test_rounds_needed_meets_target():
    n = rounds_needed(1e-16, 0.10, 1 / 3)
    assert forgery_bound(n, 0.10, 1 / 3) <= 1e-16 < forgery_bound(n - 1, 0.10, 1 / 3)


def test_sprt_flags_intercept_resend_quickly():
    rng = np.random.default_rng(0)
    seq = (rng.random(5000) < 1 / 3).astype(int)
    r = bernoulli_sprt(seq, 0.02, 0.25, 1e-6, 1e-6)
    assert r.decision == "attack" and r.rounds_used < 40   # NFR-8


def test_sprt_clears_honest_channel():
    rng = np.random.default_rng(0)
    seq = (rng.random(5000) < 0.02).astype(int)
    assert bernoulli_sprt(seq, 0.02, 0.25, 1e-6, 1e-6).decision == "honest"
