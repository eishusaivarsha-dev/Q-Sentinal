"""AI-free quantum-inspired threat detection core (D4)."""

from .adapter import evidence_from_verification
from .models import DetectionEvidence, DetectorResult
from .detector import overall_alert, run_all_detectors
from .replay import ReplayGuard

__all__ = [
    "DetectionEvidence",
    "DetectorResult",
    "evidence_from_verification",
    "overall_alert",
    "run_all_detectors",
    "ReplayGuard",
]
