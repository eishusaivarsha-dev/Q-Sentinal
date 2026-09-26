"""Attack 7: repudiation / denial-of-verification."""

from __future__ import annotations

from dataclasses import replace

from .base import AttackContext, AttackScenario, clone_scenario


def run(base: AttackScenario, ctx: AttackContext) -> AttackScenario:
    scenario = clone_scenario(base)
    scenario.signature = replace(scenario.signature, basis_commitment="0" * 64)
    scenario.expected_detector = "D6"
    scenario.description = "A party attempts to deny a previously bound verification transcript."
    return scenario
