"""D6 seed-reproducible attack campaign runner."""

from __future__ import annotations

from dataclasses import asdict
import json
from pathlib import Path
from typing import Iterable

import numpy as np

from qsentinel.detect.detector import overall_alert, run_all_detectors
from qsentinel.detect.models import DetectionEvidence
from qsentinel.qds.models import Signature
from qsentinel.quantum.states import measure_projectively

from .base import ATTACK_DETECTOR_MAP, AttackContext, AttackScenario, clone_scenario
from .blind_forgery import run as blind_forgery
from .entangle_measure import run as entangle_and_measure
from .intercept_resend import run as intercept_resend
from .mitm import run as mitm_classical
from .partial_forgery import run as partial_forgery
from .replay import run as replay
from .repudiation import run as repudiation
from .yaml_loader import load_campaign

ATTACKS = {
    "blind_forgery": blind_forgery,
    "known_basis_partial_forgery": partial_forgery,
    "intercept_resend": intercept_resend,
    "entangle_and_measure": entangle_and_measure,
    "replay": replay,
    "mitm_classical": mitm_classical,
    "repudiation": repudiation,
}


def _scenario_evidence(
    scenario: AttackScenario,
    observed: list[int],
    expected: list[int],
    nonce_already_used: bool,
) -> DetectionEvidence:
    return DetectionEvidence(
        observed=tuple(observed),
        expected=tuple(expected),
        bases=tuple(scenario.verifier_key.bases),
        verifier_id=scenario.signature.verifier_id,
        expected_verifier_id=scenario.verifier_key.verifier_id,
        nonce=scenario.signature.nonce,
        nonce_already_used=nonce_already_used,
        basis_commitment=scenario.signature.basis_commitment,
        expected_basis_commitment=scenario.verifier_key.basis_commitment,
        pair_ids=tuple(scenario.signature.pair_ids),
        expected_pair_ids=tuple(scenario.verifier_key.pair_ids),
        bsm_counts=scenario.bsm_counts or {"00": 25, "01": 25, "10": 25, "11": 25},
        chsh_value=scenario.chsh_value,
        bell_fidelity=scenario.bell_fidelity,
        message_digest_ok=scenario.message_digest_ok,
        attack_label=scenario.name,
    )


def run_attack(
    base: AttackScenario,
    name: str,
    *,
    seed: int,
    strength: float = 1.0,
) -> dict:
    """Run one named attack from the deterministic harness."""
    if name not in ATTACKS:
        raise KeyError(f"Unknown attack: {name}")
    ctx = AttackContext(seed=int(seed), strength=float(strength))
    scenario = ATTACKS[name](clone_scenario(base), ctx)
    rng = np.random.default_rng(ctx.seed + 1000)
    observed = [
        measure_projectively(state, basis, rng=rng)
        for state, basis in zip(scenario.public_key.states, scenario.verifier_key.bases)
    ]
    nonce_already_used = name == "replay"
    evidence = _scenario_evidence(
        scenario,
        observed=observed,
        expected=list(scenario.verifier_key.expected_outcomes),
        nonce_already_used=nonce_already_used,
    )
    detectors = run_all_detectors(evidence)
    expected_detector = ATTACK_DETECTOR_MAP[name]
    return {
        "attack": name,
        "seed": ctx.seed,
        "strength": ctx.strength,
        "description": scenario.description,
        "expected_detector": expected_detector,
        "mapped_detector_detected": bool(detectors[expected_detector].detected),
        "overall_alert": bool(overall_alert(detectors)),
        "observed": observed,
        "expected": list(scenario.verifier_key.expected_outcomes),
        "detectors": {key: value.as_dict() for key, value in detectors.items()},
    }


def run_campaign(
    base: AttackScenario,
    *,
    seed: int = 2026,
    strength: float = 1.0,
) -> list[dict]:
    """Run all seven attacks with deterministic per-attack seeds."""
    return [
        run_attack(base, name, seed=seed + offset, strength=strength)
        for offset, name in enumerate(ATTACKS)
    ]


def run_from_config(base: AttackScenario, config_path: str | Path) -> dict:
    """Run the attack described by a YAML campaign configuration."""
    cfg = load_campaign(config_path)
    return run_attack(
        base,
        str(cfg["attack"]),
        seed=int(cfg["seed"]),
        strength=float(cfg.get("strength", 1.0)),
    )


def validate_reproducibility(
    base: AttackScenario,
    *,
    seed: int = 2026,
    strength: float = 1.0,
) -> bool:
    """Return True iff the full seven-attack campaign is bit-for-bit identical."""
    first = run_campaign(base, seed=seed, strength=strength)
    second = run_campaign(base, seed=seed, strength=strength)
    return first == second


def save_campaign_report(results: list[dict], output_path: str | Path) -> None:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(results, indent=2, sort_keys=True), encoding="utf-8")
