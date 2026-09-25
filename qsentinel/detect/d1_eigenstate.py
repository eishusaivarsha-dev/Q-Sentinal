"""D1 - Deterministic Eigenstate Verifier (baseline integrity).

An honest signature is an eigenstate of the measured basis, so on a noiseless channel every
outcome matches. D1 reports whether the run was perfectly deterministic. On noisy channels a
non-zero count is expected, so D1 is informational; D2/D4 carry the decision.
"""

from .base import DetectionContext, DetectorResult, Severity


def run(ctx: DetectionContext) -> DetectorResult:
    total = int(ctx.transcript.block_mismatches.sum())
    return DetectorResult(
        detector="D1", name="Deterministic Eigenstate Verifier", alert=total > 0,
        severity=Severity.INFO, statistic=float(total), threshold=0.0,
        detail="all outcomes deterministic" if total == 0
        else f"{total} non-deterministic outcomes of {ctx.transcript.total_rounds}",
    )
