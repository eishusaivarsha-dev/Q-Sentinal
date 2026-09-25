"""D2 - Forgery Estimator.

Rule: REJECT if any digest-bit block has more than floor(tau * n) mismatches, where
tau = protocol.tau for a direct verification and protocol.tau_transfer for a forwarded one.
Bound: a forger passes a block with probability <= exp(-n KL(tau || q)) (Chernoff), and the
exact binomial value is reported alongside. q = 1/4 (two-basis) or 1/3 (six-state).
Per-block (not global) so that a MITM that flips only a few digest bits is still caught.
"""

import numpy as np

from .base import DetectionContext, DetectorResult, Severity
from .calibrate import (
    forgery_bound,
    forgery_exact,
    honest_rejection_bound,
    honest_rejection_exact,
)


def run(ctx: DetectionContext) -> DetectorResult:
    p = ctx.settings.protocol
    n = ctx.transcript.rounds_per_bit
    tau = p.tau_transfer if ctx.transferred else p.tau
    limit = int(np.floor(tau * n))
    blocks = ctx.transcript.block_mismatches
    bad = np.flatnonzero(blocks > limit)
    worst = int(blocks.max()) if blocks.size else 0
    st = ctx.monitor.state(ctx.link) if ctx.monitor else None
    noise = max(st.baseline.qber if st else 0.0, ctx.settings.detectors.expected_noise)
    return DetectorResult(
        detector="D2", name="Forgery Estimator", alert=bad.size > 0,
        severity=Severity.CRITICAL if bad.size else Severity.INFO,
        statistic=float(worst), threshold=float(limit),
        detail=(f"{bad.size} of {blocks.size} digest blocks exceed {limit}/{n} mismatches"
                if bad.size else f"all {blocks.size} blocks within {limit}/{n} mismatches")
        + (" [transferred]" if ctx.transferred else ""),
        extra={
            "tau": tau,
            "failed_blocks": bad.tolist()[:32],
            "forgery_bound_per_block": forgery_bound(n, tau, p.forger_mismatch),
            "forgery_exact_per_block": forgery_exact(n, tau, p.forger_mismatch),
            "honest_rejection_bound_per_block": honest_rejection_bound(n, tau, noise),
            "honest_rejection_exact_per_block": honest_rejection_exact(n, tau, noise),
        },
    )
