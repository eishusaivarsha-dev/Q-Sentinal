"""D4 - Channel Anomaly Detector (intercept-resend, collective attacks).

    QBER rule:  alert if QBER > qber_max (intercept-resend => ~25% two-basis / ~33% six-state)
    SPRT:       Wald test, H0 QBER = expected_noise vs H1 QBER = attack_qber; reports how many
                rounds were needed to decide (detection latency, NFR-8)
    chi-square: uniformity of the 4 BSM outcomes. NOTE: by no-signalling this only detects
                tampering at the source / signer side, NOT intercept-resend on the verifier leg.
"""

import numpy as np
from scipy.stats import chisquare

from .base import DetectionContext, DetectorResult, Severity
from .sequential import bernoulli_sprt


def run(ctx: DetectionContext) -> DetectorResult:
    cfg = ctx.settings.detectors
    t = ctx.transcript
    qber = t.qber
    sprt = bernoulli_sprt(t.mismatch_seq, cfg.expected_noise, cfg.attack_qber,
                          cfg.sprt_alpha, cfg.sprt_beta)
    counts = np.bincount(t.bsm[:, 0] * 2 + t.bsm[:, 1], minlength=4) if t.bsm.size else np.zeros(4)
    chi_p = float(chisquare(counts).pvalue) if counts.sum() else 1.0

    qber_alert = qber > cfg.qber_max
    sprt_alert = sprt.decision == "attack"
    chi_alert = chi_p < cfg.chi2_pvalue_min
    alert = qber_alert or sprt_alert or chi_alert
    reasons = [r for r, on in (("QBER above threshold", qber_alert),
                               (f"SPRT flagged attack after {sprt.rounds_used} rounds", sprt_alert),
                               ("BSM outcomes not uniform", chi_alert)) if on]
    return DetectorResult(
        detector="D4", name="Channel Anomaly Detector", alert=alert,
        severity=Severity.CRITICAL if (qber_alert or sprt_alert) else
        (Severity.WARNING if chi_alert else Severity.INFO),
        statistic=qber, threshold=cfg.qber_max,
        detail=("; ".join(reasons) if reasons else f"QBER {qber:.4f} nominal") + f" (QBER={qber:.4f})",
        extra={"qber": qber, "sprt_decision": sprt.decision, "sprt_rounds": sprt.rounds_used,
               "bsm_counts": counts.tolist(), "chi2_p": chi_p},
    )
