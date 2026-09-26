"""Attack 6: classical-channel man-in-the-middle."""

from __future__ import annotations

from dataclasses import replace

from .base import AttackContext, AttackScenario, clone_scenario


def run(base: AttackScenario, ctx: AttackContext) -> AttackScenario:
    scenario = clone_scenario(base)
    scenario.signature = replace(scenario.signature, verifier_id="attacker-verifier")
    scenario.expected_detector = "D6"
    scenario.description = "Classical MITM changes the recipient identity carried by the signature envelope."
    return scenario
