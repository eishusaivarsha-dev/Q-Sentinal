"""Composite entry point for the six AI-free detectors."""

from __future__ import annotations

from .models import DetectionEvidence, DetectorResult
from .eigenstate import detect as detect_eigenstate
from .forgery import detect as detect_forgery
from .entanglement import detect as detect_entanglement
from .channel import detect as detect_channel
from .replay import detect as detect_replay
from .identity import detect as detect_identity


def run_all_detectors(
    evidence: DetectionEvidence,
    *,
    forgery_alpha: float = 1e-6,
    qber_threshold: float = 0.12,
) -> dict[str, DetectorResult]:
    """Run all six detectors and return a stable-name mapping."""
    results = {
        "D1": detect_eigenstate(evidence),
        "D2": detect_forgery(evidence, alpha=forgery_alpha),
        "D3": detect_entanglement(evidence),
        "D4": detect_channel(evidence, qber_threshold=qber_threshold),
        "D5": detect_replay(evidence),
        "D6": detect_identity(evidence),
    }
    return results


def overall_alert(results: dict[str, DetectorResult]) -> bool:
    """Return True when any detector raises an alert."""
    return any(item.detected for item in results.values())
