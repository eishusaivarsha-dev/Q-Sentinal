"""Attack 2: known-basis partial forgery."""

from __future__ import annotations

from qsentinel.quantum.states import state_for_label
from .base import AttackContext, AttackScenario, clone_scenario


def run(base: AttackScenario, ctx: AttackContext) -> AttackScenario:
    scenario = clone_scenario(base)
    rng = ctx.rng()
    fraction = min(max(ctx.strength * 0.25, 0.05), 1.0)
    count = max(1, int(round(len(scenario.public_key.states) * fraction)))
    indices = rng.choice(len(scenario.public_key.states), size=count, replace=False)
    for idx in indices:
        basis = scenario.verifier_key.bases[int(idx)]
        # Pick the opposite eigenstate in the committed basis.
        replacement = {
            "Z": ("1" if scenario.verifier_key.expected_outcomes[int(idx)] == 0 else "0"),
            "X": ("-" if scenario.verifier_key.expected_outcomes[int(idx)] == 0 else "+"),
            "Y": ("-i" if scenario.verifier_key.expected_outcomes[int(idx)] == 0 else "+i"),
        }[basis]
        scenario.public_key.states[int(idx)] = state_for_label(replacement)
    scenario.expected_detector = "D1"
    scenario.description = f"Partial forgery affecting {count}/{len(scenario.public_key.states)} rounds."
    return scenario
