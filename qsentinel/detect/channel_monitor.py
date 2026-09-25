"""Channel-level memory for each signer->verifier link (D3 rolling window, D4 CUSUM, fingerprint).

Per-signature tests have a blind spot. An attacker can keep each single verification just
under every threshold and win over many verifications. This monitor adds memory across
verifications:

  * FROZEN BASELINE. Each link is commissioned once, in a trusted window, by sending test
    rounds whose states are revealed immediately. The measured per-basis error rates, QBER
    and Bell correlators become the link's reference, and the commissioning record is written
    to the ledger. Live traffic NEVER updates the baseline. That stops a "boiling-frog"
    attacker who drifts the channel slowly so an adaptive baseline follows along.
    Re-commissioning is an explicit, logged admin action.
  * CUSUM on the per-verification QBER excess over baseline. Catches small sustained excess.
  * Rolling Bell window. Pools CHSH correlators over the last K checks for a tighter estimate.

Detectors only READ this object; the engine records a verification after the verdict, and only
when D2 found no forgery (a forger's mismatches are not channel errors).
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field

from .fingerprint import PerBasis


def link_id(signer_id: str, verifier_id: str) -> str:
    return f"{signer_id}->{verifier_id}"


@dataclass
class LinkBaseline:
    per_basis: PerBasis
    qber: float
    correlators: dict[str, float]
    pairs: int

    def summary(self) -> dict:
        return {"per_basis": {str(b): list(v) for b, v in self.per_basis.items()},
                "qber": self.qber, "correlators": self.correlators, "pairs": self.pairs}


@dataclass
class LinkState:
    baseline: LinkBaseline
    bell_window: deque = field(default_factory=deque)
    cusum: float = 0.0
    verifications: int = 0
    cusum_alarms: int = 0


class ChannelMonitor:
    def __init__(self, window: int = 10):
        self.window = window
        self.links: dict[str, LinkState] = {}

    def has(self, link: str) -> bool:
        return link in self.links

    def state(self, link: str) -> LinkState | None:
        return self.links.get(link)

    def commission(self, link: str, per_basis: PerBasis, correlators: dict[str, float],
                   pairs: int) -> LinkBaseline:
        errors = sum(e for e, _ in per_basis.values())
        total = sum(t for _, t in per_basis.values())
        base = LinkBaseline(per_basis, errors / total if total else 0.0, dict(correlators), pairs)
        self.links[link] = LinkState(baseline=base, bell_window=deque(maxlen=self.window))
        return base

    def windowed_correlators(self, link: str, current: dict[str, float],
                             pairs: int) -> tuple[dict[str, float], int]:
        st = self.links.get(link)
        entries = list(st.bell_window) if st else []
        entries.append((current, pairs))
        total = sum(p for _, p in entries)
        pooled = {k: sum(c[k] * p for c, p in entries) / total for k in current}
        return pooled, total

    def cusum_next(self, link: str, qber: float, slack: float) -> float:
        st = self.links.get(link)
        if st is None:
            return 0.0
        return max(0.0, st.cusum + (qber - st.baseline.qber) - slack)

    def record(self, link: str, correlators: dict[str, float] | None, pairs: int,
               cusum_value: float, cusum_alarm: bool) -> None:
        st = self.links.get(link)
        if st is None:
            return
        st.verifications += 1
        st.cusum = 0.0 if cusum_alarm else cusum_value   # reset after raising an alarm
        st.cusum_alarms += int(cusum_alarm)
        if correlators is not None:
            st.bell_window.append((dict(correlators), pairs))

    def status(self) -> dict:
        return {k: {"baseline": s.baseline.summary(), "verifications": s.verifications,
                    "cusum": s.cusum, "cusum_alarms": s.cusum_alarms}
                for k, s in self.links.items()}
