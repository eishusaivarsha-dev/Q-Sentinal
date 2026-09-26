"""D1-D6 acceptance report for the integrated system.

Anansh Jain's D1-D6 workstream shipped a stand-alone acceptance script (examples/acceptance_checks.py)
for its own reference implementation. This module runs the same acceptance criteria against the
REAL pipeline - the Stim backend, the exact state-vector engine, the detectors, the ledger - so one
report covers the code the dashboard and the API actually use.

    python -m qsentinel.acceptance            # quick (about 10 s): the API's GET /report/acceptance
    python -m qsentinel.acceptance --full     # 10,000 honest signatures, 100k-trial FAR check

Exit code 1 if any criterion fails.
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

from .attacks.run import run_campaign
from .config import FAST, FORGER_MISMATCH
from .detect.calibrate import forgery_bound, forgery_exact
from .detect.validate import false_alarm_validation, monte_carlo_forgery
from .pipeline import QSentinel
from .qds import verify
from .quantum import ChannelModel, get_backend
from .quantum import statevector as sv

CAMPAIGN = Path(__file__).parent / "attacks" / "campaigns" / "smoke.yaml"
ML_MODULES = {"sklearn", "torch", "tensorflow", "keras", "xgboost", "lightgbm", "prophet", "transformers",
              "anthropic", "openai", "qsentinel_ops"}


def _check(cid: str, title: str, passed: bool, evidence: dict, criterion: str) -> dict:
    return {"id": cid, "title": title, "criterion": criterion, "passed": bool(passed), "evidence": evidence}


def d1_bounds() -> dict:
    q = FORGER_MISMATCH["two-basis"]
    headline = forgery_bound(128, 0.0, q)
    exact = forgery_exact(256, 0.10, 1 / 3)
    ok = math.isclose(headline, 0.75 ** 128, rel_tol=1e-9) and exact <= forgery_bound(256, 0.10, 1 / 3)
    return _check("D1", "Protocol maths", ok,
                  {"(3/4)^128": headline, "exact_per_block_n256_tau10": exact,
                   "chernoff_per_block_n256_tau10": forgery_bound(256, 0.10, 1 / 3),
                   "spec": "docs/protocol/qds_protocol.pdf"},
                  "Closed-form bounds reproduce the specification; exact tail <= Chernoff bound")


def d2_substrate(seed: int) -> dict:
    rng = np.random.default_rng(seed)
    fids = []
    for _ in range(300):
        theta, phi = math.acos(rng.uniform(-1, 1)), rng.uniform(0, 2 * math.pi)
        fids.append(sv.teleport(sv.state_from_bloch(theta, phi), rng=rng).fidelity)
    n = 20_000
    b, v = rng.integers(0, 3, n), rng.integers(0, 2, n)
    stim = get_backend("stim")
    ideal = stim.teleport_and_measure(b, v, b, ChannelModel(), seed)
    freq = np.bincount(ideal.bsm[:, 0] * 2 + ideal.bsm[:, 1], minlength=4)
    from scipy.stats import chisquare
    chi2, p_value = chisquare(freq)
    eve = ChannelModel(intercept_fraction=1.0)
    stim_qber = float((stim.teleport_and_measure(b, v, b, eve, seed + 1).outcomes != v).mean())
    exact_qber = sv.six_state_error_rate(eve)
    ok = min(fids) > 0.99 and p_value > 1e-3 and (ideal.outcomes == v).all() and abs(stim_qber - exact_qber) < 0.015
    return _check("D2", "Quantum substrate & teleportation", ok,
                  {"min_fidelity_300_random_states": min(fids), "bsm_counts": freq.tolist(), "bsm_chi2_p": float(p_value),
                   "ideal_channel_mismatches": int((ideal.outcomes != v).sum()), "rounds": n,
                   "intercept_resend_qber_stim": stim_qber, "intercept_resend_qber_exact": exact_qber},
                  "Fidelity >= 0.99; BSM uniform (chi-square p > 0.001); Stim agrees with the exact engine")


def d3_protocol(n_signatures: int, seed: int) -> dict:
    env = QSentinel(settings=FAST)
    env.register_signer("alice")
    env.register_verifier("bob")
    rejected = 0
    t0 = time.perf_counter()
    for i in range(n_signatures):
        sig = env.sign("alice", f"acceptance #{i}".encode(), seed=seed + i)
        rejected += env.verify(sig, "bob", seed=seed + i).decision != "ACCEPT"
    dt = time.perf_counter() - t0
    return _check("D3", "QDS protocol engine", rejected == 0,
                  {"honest_signatures": n_signatures, "rejected": rejected, "frr": rejected / n_signatures,
                   "profile": "fast (L=32, n=64)", "per_signature_ms": 1000 * dt / n_signatures},
                  f"{n_signatures:,} / {n_signatures:,} honest signatures accepted (FRR = 0, noiseless)")


def d4_detectors() -> dict:
    reports = run_campaign(CAMPAIGN)
    rows = [{**r.row(), "passed": r.passed} for r in reports]
    fired = sorted({d for r in reports for d in r.detectors_fired})
    return _check("D4", "Six AI-free detectors", all(r.passed for r in reports) and {"D2", "D3", "D4", "D5", "D6"} <= set(fired),
                  {"scenarios": len(rows), "passed": sum(r["passed"] for r in rows), "detectors_exercised": fired,
                   "runs": rows},
                  "Every scenario of the red-team campaign is caught by its declared detector")


def d5_calibration(trials: int, seed: int) -> dict:
    forgery = monte_carlo_forgery(16, 0.10, 20_000, seed=seed)
    far = false_alarm_validation(64, 0.10, 0.04, trials=trials, seed=seed)
    ok = forgery["relative_error"] <= 0.10 and far["exact_inside_ci"]
    return _check("D5", "Threshold calibration", ok, {"forgery": forgery, "false_alarm": far},
                  "Simulated forger within 10% of the exact bound; exact FAR inside the 95% Wilson interval")


def d6_reproducibility(seed: int) -> dict:
    """Same signature + same seed -> the quantum simulation replays bit for bit.

    (Nonces and symmetrisation shares are fresh randomness on purpose, so the check fixes the
    signature and re-runs the attacked verification from the recorded seed, which is exactly what
    an auditor does with a ledger transcript.)"""
    env = QSentinel(settings=FAST)
    env.register_signer("alice")
    env.register_verifier("bob")
    sig = env.sign("alice", b"reproducibility", seed=seed)
    pub = env.public_key(sig.key_id, "bob")
    eve = ChannelModel(intercept_fraction=0.5)
    runs = [verify(sig, pub, get_backend("stim"), eve, seed) for _ in range(2)]
    same = all((getattr(runs[0], f) == getattr(runs[1], f)).all() for f in ("mismatch_seq", "bsm", "block_mismatches"))
    return _check("D6", "Attack harness reproducibility", same,
                  {"attack": "intercept-resend on 50% of pairs", "seed": seed, "rounds": runs[0].total_rounds,
                   "qber": runs[0].qber, "identical_transcripts": same},
                  "Same seed -> bit-for-bit identical transcript")


def trust_path_guard() -> dict:
    # A fresh interpreter that imports only the trust path: the calling process (pytest, the API
    # server) may have unrelated libraries loaded, which says nothing about the kernel.
    code = ("import sys, qsentinel.pipeline, qsentinel.detect, qsentinel.qds, qsentinel.quantum, qsentinel.ledger; "
            f"print(','.join(sorted(m for m in sys.modules if m.split('.')[0] in {sorted(ML_MODULES)!r})))")
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=120)
    loaded = [m for m in out.stdout.strip().split(",") if m] if out.returncode == 0 else [f"import failed: {out.stderr[-200:]}"]
    return _check("NFR-1", "No AI in the trust path", not loaded, {"ml_modules_loaded": loaded},
                  "Importing the whole trust path loads no ML library")


def run(full: bool = False, seed: int = 2026) -> dict:
    t0 = time.time()
    checks = [d1_bounds(), d2_substrate(seed), d3_protocol(10_000 if full else 150, seed), d4_detectors(),
              d5_calibration(100_000 if full else 50_000, seed), d6_reproducibility(seed), trust_path_guard()]
    return {"generated_at": t0, "seconds": round(time.time() - t0, 2), "mode": "full" if full else "quick",
            "passed": all(c["passed"] for c in checks), "checks": checks}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--json", help="also write the report to this file")
    a = ap.parse_args(argv)
    rep = run(a.full)
    for c in rep["checks"]:
        print(f"{'PASS' if c['passed'] else 'FAIL'}  {c['id']:6} {c['title']:36} {c['criterion']}")
    print(f"\n{'ALL PASSED' if rep['passed'] else 'FAILURES'} in {rep['seconds']} s ({rep['mode']})")
    if a.json:
        Path(a.json).write_text(json.dumps(rep, indent=2, default=float))
    return 0 if rep["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
