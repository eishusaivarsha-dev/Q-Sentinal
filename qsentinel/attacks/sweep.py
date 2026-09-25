"""Detection rate vs adversary strength (for the D7 security report).

    python -m qsentinel.attacks.sweep intercept_resend --steps 11 --trials 10
    python -m qsentinel.attacks.sweep stealth_probe --max 0.2 --noise 0.03 --out stealth.csv
    python -m qsentinel.attacks.sweep repudiation_unprotected --trials 20

For each strength level it reports: rejection rate, alert rate (any warning or critical),
per-detector firing rates, pass rate (the attack's own success criterion) and mean QBER.
Strength 0 of a channel attack is the honest channel, so that row is the false-alarm rate.
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter

import numpy as np

from ..config import FAST, Settings
from ..pipeline import QSentinel
from ..quantum import ChannelModel
from .library import ATTACKS, run_attack

DETECTORS = ["D1", "D2", "D3", "D4", "D5", "D6", "AUDIT"]


def sweep(attack: str, strengths, trials: int, settings: Settings, noise: float = 0.0,
          seed: int = 0) -> list[dict]:
    rows = []
    for si, s in enumerate(strengths):
        env = QSentinel(settings=settings)       # fresh link + CUSUM state per strength level
        fired, rejected, passed, alerted, qbers = Counter(), 0, 0, 0, []
        for t in range(trials):
            rep = run_attack(env, attack, float(s), seed=seed + 1000 * si + t,
                             channel=ChannelModel(depolarizing=noise))
            rejected += rep.decision == "REJECT"
            passed += rep.passed
            alerted += bool(rep.detectors_fired)
            fired.update(set(rep.detectors_fired))
            q = next((r["statistic"] for r in rep.verdict["results"] if r["detector"] == "D4"), None)
            if q is not None:
                qbers.append(q)
        rows.append({"attack": attack, "strength": round(float(s), 4), "trials": trials,
                     "reject_rate": rejected / trials, "alert_rate": alerted / trials,
                     "pass_rate": passed / trials, "mean_qber": float(np.mean(qbers)) if qbers else None,
                     **{f"{d}_rate": fired[d] / trials for d in DETECTORS}})
    return rows


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("attack", choices=sorted(ATTACKS))
    ap.add_argument("--min", type=float, default=0.0)
    ap.add_argument("--max", type=float, default=1.0)
    ap.add_argument("--steps", type=int, default=11)
    ap.add_argument("--trials", type=int, default=10)
    ap.add_argument("--noise", type=float, default=0.0, help="honest depolarising noise")
    ap.add_argument("--full", action="store_true", help="full-size protocol (L=256, n=256)")
    ap.add_argument("--out", help="CSV output path")
    a = ap.parse_args(argv)
    rows = sweep(a.attack, np.linspace(a.min, a.max, a.steps), a.trials,
                 Settings() if a.full else FAST, a.noise)
    print(f"{'strength':>8} {'reject':>7} {'alert':>6} {'pass':>5} {'QBER':>7}  detectors")
    for r in rows:
        det = " ".join(f"{d}={r[f'{d}_rate']:.2f}" for d in DETECTORS if r[f"{d}_rate"])
        q = f"{r['mean_qber']:.4f}" if r["mean_qber"] is not None else "   -  "
        print(f"{r['strength']:>8} {r['reject_rate']:>7.2f} {r['alert_rate']:>6.2f} "
              f"{r['pass_rate']:>5.2f} {q:>7}  {det}")
    if a.out:
        with open(a.out, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)
        print(f"wrote {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
