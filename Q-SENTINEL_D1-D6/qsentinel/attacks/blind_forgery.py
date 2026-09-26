"""Attack 1: blind forgery."""

from __future__ import annotations

from qsentinel.quantum.states import random_bloch_state
from .base import AttackContext, AttackScenario, clone_scenario


def run(base: AttackScenario, ctx: AttackContext) -> AttackScenario:
    scenario = clone_scenario(base)
    rng = ctx.rng()
    # The attacker does not know the committed basis, so replace every state
    # by an independent random Bloch-sphere state.
    scenario.public_key.states = [random_bloch_state(rng) for _ in scenario.public_key.states]
    scenario.chsh_value = 1.4
    scenario.bell_fidelity = 0.35
    scenario.expected_detector = "D2"
    scenario.description = "Blind basis-guessing forgery with no private basis sequence."
    return scenario
