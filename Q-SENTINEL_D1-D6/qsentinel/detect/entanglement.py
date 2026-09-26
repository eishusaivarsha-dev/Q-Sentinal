"""Detector 3: entanglement integrity monitor."""

from __future__ import annotations

from .models import DetectionEvidence, DetectorResult


def detect(
    evidence: DetectionEvidence,
    *,
    min_chsh: float = 2.0,
    min_bell_fidelity: float = 0.90,
) -> DetectorResult:
    """Alert when CHSH or Bell fidelity falls below the configured floor."""
    chsh = evidence.chsh_value
    fidelity = evidence.bell_fidelity
    missing = chsh is None or fidelity is None
    chsh_bad = chsh is not None and chsh < min_chsh
    fidelity_bad = fidelity is not None and fidelity < min_bell_fidelity
    detected = chsh_bad or fidelity_bad
    scores = [v for v in (chsh, fidelity) if v is not None]
    score = float(min(scores)) if scores else None
    return DetectorResult(
        name="D3_entanglement_integrity_monitor",
        detected=detected,
        score=score,
        threshold=None,
        details={
            "chsh": chsh,
            "classical_chsh_bound": 2.0,
            "tsirelson_bound": float(2.0 * 2.0 ** 0.5),
            "bell_fidelity": fidelity,
            "min_chsh": min_chsh,
            "min_bell_fidelity": min_bell_fidelity,
            "telemetry_complete": not missing,
        },
    )
