"""D2 - Forgery Estimator.

Rule: REJECT if any digest-bit block has more than floor(tau * n) mismatches.
Bound: an uninformed forger passes a block with prob. <= exp(-n KL(tau || q)), q = 1/4 or 1/3.
Per-block (not global) so that a MITM that flips only a few digest bits is still caught.
"""

import numpy as np

from .base import DetectionContext, DetectorResult, Severity
from .calibrate import forgery_bound, honest_rejection_bound


def run(ctx: DetectionContext) -> DetectorResult:
    p = ctx.settings.protocol
    n = ctx.transcript.rounds_per_bit
    limit = int(np.floor(p.tau * n))
    blocks = ctx.transcript.block_mismatches
    bad = np.flatnonzero(blocks > limit)
    worst = int(blocks.max()) if blocks.size else 0
    return DetectorResult(
        detector="D2", name="Forgery Estimator", alert=bad.size > 0,
        severity=Severity.CRITICAL if bad.size else Severity.INFO,
        statistic=float(worst), threshold=float(limit),
        detail=(f"{bad.size} of {blocks.size} digest blocks exceed {limit}/{n} mismatches"
                if bad.size else f"all {blocks.size} blocks within {limit}/{n} mismatches"),
        extra={
            "failed_blocks": bad.tolist()[:32],
            "forgery_bound_per_block": forgery_bound(n, p.tau, p.forger_mismatch),
            "honest_rejection_bound_at_expected_noise": honest_rejection_bound(
                n, p.tau, ctx.settings.detectors.expected_noise),
        },
    )
