"""Detector 5: nonce and freshness guard."""

from __future__ import annotations

from .models import DetectionEvidence, DetectorResult


class ReplayGuard:
    """Stateful nonce registry for replay detection."""

    def __init__(self) -> None:
        self._seen: set[str] = set()

    def consume(self, nonce: str) -> bool:
        """Return False if nonce was already consumed; otherwise register it and return True."""
        if nonce in self._seen:
            return False
        self._seen.add(nonce)
        return True

    def contains(self, nonce: str) -> bool:
        return nonce in self._seen

    def clear(self) -> None:
        self._seen.clear()


def detect(evidence: DetectionEvidence) -> DetectorResult:
    return DetectorResult(
        name="D5_replay_freshness_guard",
        detected=evidence.nonce_already_used,
        score=1.0 if evidence.nonce_already_used else 0.0,
        threshold=0.5,
        details={"nonce": evidence.nonce, "already_used": evidence.nonce_already_used},
    )
