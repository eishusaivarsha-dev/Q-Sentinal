"""Attack 5: replay of an already-used signature."""

from __future__ import annotations

from .base import AttackContext, AttackScenario, clone_scenario


def run(base: AttackScenario, ctx: AttackContext) -> AttackScenario:
    scenario = clone_scenario(base)
    scenario.expected_detector = "D5"
    scenario.description = "A previously accepted transcript is submitted again with the same nonce."
    return scenario
