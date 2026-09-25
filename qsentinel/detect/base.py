"""Shared detector types. Every detector is a closed-form rule with a stated error bound."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

from ..config import Settings
from ..qds.keys import PublicKeyHandle
from ..qds.protocol import Signature, VerificationTranscript
from .registry import IdentityRegistry, NonceRegistry


class Severity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"   # any CRITICAL alert => REJECT


@dataclass
class DetectorResult:
    detector: str           # "D1".."D6"
    name: str
    alert: bool
    severity: Severity
    statistic: float | None
    threshold: float | None
    detail: str
    extra: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {**self.__dict__, "severity": self.severity.value}


@dataclass
class DetectionContext:
    signature: Signature
    pubkey: PublicKeyHandle
    transcript: VerificationTranscript
    settings: Settings
    nonces: NonceRegistry
    identities: IdentityRegistry
    bell: dict[str, float] | None = None   # channel correlators <XX>,<YY>,<ZZ> for D3
    now: float | None = None
