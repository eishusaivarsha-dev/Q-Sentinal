"""D5 - Replay & Freshness Guard.

No-cloning means a replay can only be a replay of the classical transcript, so it is caught
by: single-use nonce, monotonic per-signer counter, timestamp window, one-time key.
"""

import time

from .base import DetectionContext, DetectorResult, Severity


def run(ctx: DetectionContext) -> DetectorResult:
    sig = ctx.signature
    problems = ctx.nonces.check(sig.signer_id, sig.nonce.hex(), sig.counter)
    now = ctx.now if ctx.now is not None else time.time()
    age = now - sig.timestamp
    if abs(age) > ctx.settings.detectors.timestamp_window_s:
        problems.append(f"timestamp outside freshness window ({age:.0f}s old)")
    return DetectorResult(
        detector="D5", name="Replay & Freshness Guard", alert=bool(problems),
        severity=Severity.CRITICAL if problems else Severity.INFO,
        statistic=age, threshold=ctx.settings.detectors.timestamp_window_s,
        detail="; ".join(problems) if problems else "fresh nonce, counter and timestamp",
    )
