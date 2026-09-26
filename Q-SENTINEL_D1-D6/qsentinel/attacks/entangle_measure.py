"""Attack 4: entangle-and-measure."""

from __future__ import annotations

from qsentinel.quantum.states import random_bloch_state
from .base import AttackContext, AttackScenario, clone_scenario


def run(base: AttackScenario, ctx: AttackContext) -> AttackScenario:
    scenario = clone_scenario(base)
    rng = ctx.rng()
    # Model information leakage as a modest state disturbance plus clear
    # entanglement degradation.
    count = max(1, int(0.35 * len(scenario.public_key.states)))
    for idx in rng.choice(len(scenario.public_key.states), size=count, replace=False):
        scenario.public_key.states[int(idx)] = random_bloch_state(rng)
    scenario.chsh_value = 1.7
    scenario.bell_fidelity = 0.72
    scenario.expected_detector = "D3"
    scenario.description = "Probe interaction disturbs entanglement and part of the public-state sequence."
    return scenario
