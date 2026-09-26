"""Bell states and Bell-state utilities."""

from __future__ import annotations

import numpy as np

SQRT2 = np.sqrt(2.0)

BELL_STATES: dict[str, np.ndarray] = {
    "Phi+": np.array([1, 0, 0, 1], dtype=complex) / SQRT2,
    "Phi-": np.array([1, 0, 0, -1], dtype=complex) / SQRT2,
    "Psi+": np.array([0, 1, 1, 0], dtype=complex) / SQRT2,
    "Psi-": np.array([0, 1, -1, 0], dtype=complex) / SQRT2,
}


def bell_state(name: str = "Phi+") -> np.ndarray:
    """Return a copy of a Bell state vector."""
    if name not in BELL_STATES:
        raise ValueError(f"Unknown Bell state: {name}")
    return BELL_STATES[name].copy()


def phi_plus() -> np.ndarray:
    """Return |Phi+> = (|00> + |11>) / sqrt(2)."""
    return bell_state("Phi+")


def bell_fidelity(state: np.ndarray, target: np.ndarray | None = None) -> float:
    """Compute pure-state fidelity with a Bell state."""
    if target is None:
        target = phi_plus()
    state = np.asarray(state, dtype=complex)
    state = state / np.linalg.norm(state)
    target = np.asarray(target, dtype=complex)
    target = target / np.linalg.norm(target)
    return float(abs(np.vdot(target, state)) ** 2)
