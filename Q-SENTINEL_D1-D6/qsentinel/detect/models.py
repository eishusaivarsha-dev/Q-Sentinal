"""Shared detection models."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class DetectionEvidence:
    observed: tuple[int, ...]
    expected: tuple[int, ...]
    bases: tuple[str, ...]
    verifier_id: str
    expected_verifier_id: str
    nonce: str
    nonce_already_used: bool
    basis_commitment: str
    expected_basis_commitment: str
    pair_ids: tuple[str, ...]
    expected_pair_ids: tuple[str, ...]
    bsm_counts: dict[str, int] = field(default_factory=dict)
    chsh_value: float | None = None
    bell_fidelity: float | None = None
    message_digest_ok: bool = True
    attack_label: str | None = None


@dataclass(frozen=True)
class DetectorResult:
    name: str
    detected: bool
    score: float | None
    threshold: float | None
    details: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "detected": self.detected,
            "score": self.score,
            "threshold": self.threshold,
            "details": self.details,
        }
