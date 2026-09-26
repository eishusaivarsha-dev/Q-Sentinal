"""Attack 3: intercept-resend."""

from __future__ import annotations

from qsentinel.quantum.states import random_eigenstate
from .base import AttackContext, AttackScenario, clone_scenario


def run(base: AttackScenario, ctx: AttackContext) -> AttackScenario:
    scenario = clone_scenario(base)
    rng = ctx.rng()
    for idx, basis in enumerate(scenario.verifier_key.bases):
        # Simulate an attacker measuring/resending in a randomly selected Pauli basis.
        attack_basis = str(rng.choice(["Z", "X", "Y"]))
        label, state, _ = random_eigenstate(rng, basis=attack_basis)
        scenario.public_key.states[idx] = state
    scenario.chsh_value = 0.9
    scenario.bell_fidelity = 0.55
    scenario.expected_detector = "D4"
    scenario.description = "Intercept-resend measured in attacker-selected Pauli bases."
    return scenario
