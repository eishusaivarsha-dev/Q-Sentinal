"""D4 - Channel Anomaly Detector (intercept-resend, collective and stealth attacks).

Five closed-form tests on the verification transcript:
    QBER rule     CRITICAL if QBER > qber_max (intercept-resend => ~25% two-basis / ~33% six-state)
    Wald SPRT     CRITICAL if H1 (QBER = attack_qber) beats H0 (QBER = link baseline, floored at
                  expected_noise); also reports how many rounds the decision needed (NFR-8)
    Fingerprint   WARNING if the per-basis error pattern drifts from the link's frozen baseline
                  (G-test, p < fingerprint_alpha and effect >= min_effect). Also attributes the
                  attack: "single-axis probe along Z" etc. See fingerprint.py.
    CUSUM         WARNING if QBER excess over baseline accumulates across verifications
    chi-square    WARNING if the 4 BSM outcomes are not uniform. NOTE: by no-signalling this only
                  detects tampering at the source / signer side, NOT on the verifier leg.
"""

import numpy as np
from scipy.stats import chisquare

from .base import DetectionContext, DetectorResult, Severity
from .fingerprint import fingerprint, per_basis_counts
from .sequential import bernoulli_sprt


def run(ctx: DetectionContext) -> DetectorResult:
    cfg = ctx.settings.detectors
    t = ctx.transcript
    qber = t.qber
    st = ctx.monitor.state(ctx.link) if ctx.monitor else None

    p0 = min(max(cfg.expected_noise, st.baseline.qber if st else 0.0), cfg.attack_qber / 2)
    sprt = bernoulli_sprt(t.mismatch_seq, p0, cfg.attack_qber, cfg.sprt_alpha, cfg.sprt_beta)
    counts = np.bincount(t.bsm[:, 0] * 2 + t.bsm[:, 1], minlength=4) if t.bsm.size else np.zeros(4)
    chi_p = float(chisquare(counts).pvalue) if counts.sum() else 1.0
    fp = fingerprint(per_basis_counts(t.meas_bases, t.mismatch_seq, ctx.settings.protocol.bases),
                     st.baseline.per_basis if st else None,
                     cfg.fingerprint_alpha, cfg.fingerprint_min_effect)
    cusum = ctx.monitor.cusum_next(ctx.link, qber, cfg.cusum_slack) if st else 0.0

    qber_alert = qber > cfg.qber_max
    sprt_alert = sprt.decision == "attack"
    fp_alert = fp.drift
    cusum_alert = cusum > cfg.cusum_threshold
    chi_alert = chi_p < cfg.chi2_pvalue_min
    reasons = [r for r, on in (
        ("QBER above threshold", qber_alert),
        (f"SPRT flagged attack after {sprt.rounds_used} rounds", sprt_alert),
        (f"fingerprint drift - {fp.label}", fp_alert),
        (f"CUSUM {cusum:.3f} > {cfg.cusum_threshold} (sustained excess across verifications)",
         cusum_alert),
        ("BSM outcomes not uniform", chi_alert)) if on]
    critical = qber_alert or sprt_alert
    return DetectorResult(
        detector="D4", name="Channel Anomaly Detector", alert=bool(reasons),
        severity=Severity.CRITICAL if critical else (Severity.WARNING if reasons else Severity.INFO),
        statistic=qber, threshold=cfg.qber_max,
        detail=("; ".join(reasons) if reasons else "channel nominal") + f" (QBER={qber:.4f})",
        extra={"qber": qber, "sprt_decision": sprt.decision, "sprt_rounds": sprt.rounds_used,
               "sprt_p0": p0, "rounds_saved_by_sprt": max(0, t.total_rounds - sprt.rounds_used)
               if sprt.decision == "attack" else 0,
               "fingerprint": fp.to_dict(), "cusum": cusum, "cusum_alarm": cusum_alert,
               "bsm_counts": counts.tolist(), "chi2_p": chi_p},
    )
