"""Pauli eigenstates, state preparation, and projective measurements."""

from __future__ import annotations

from typing import Literal

import numpy as np

Basis = Literal["Z", "X", "Y"]

SQRT2 = np.sqrt(2.0)

EIGENSTATES: dict[str, np.ndarray] = {
    "0": np.array([1.0 + 0j, 0.0 + 0j]),
    "1": np.array([0.0 + 0j, 1.0 + 0j]),
    "+": np.array([1.0, 1.0], dtype=complex) / SQRT2,
    "-": np.array([1.0, -1.0], dtype=complex) / SQRT2,
    "+i": np.array([1.0, 1.0j], dtype=complex) / SQRT2,
    "-i": np.array([1.0, -1.0j], dtype=complex) / SQRT2,
}

BASIS_LABELS: dict[Basis, tuple[str, str]] = {
    "Z": ("0", "1"),
    "X": ("+", "-"),
    "Y": ("+i", "-i"),
}

LABEL_BASIS: dict[str, Basis] = {
    "0": "Z",
    "1": "Z",
    "+": "X",
    "-": "X",
    "+i": "Y",
    "-i": "Y",
}


def _normalize(state: np.ndarray) -> np.ndarray:
    state = np.asarray(state, dtype=complex)
    norm = np.linalg.norm(state)
    if norm == 0:
        raise ValueError("State vector cannot be the zero vector.")
    return state / norm


def state_for_label(label: str) -> np.ndarray:
    """Return a copy of one of the six Pauli eigenstates."""
    if label not in EIGENSTATES:
        raise ValueError(f"Unknown eigenstate label: {label}")
    return EIGENSTATES[label].copy()


def expected_outcome(label: str) -> int:
    """Return computational outcome 0/1 associated with the eigenstate sign."""
    if label in {"0", "+", "+i"}:
        return 0
    if label in {"1", "-", "-i"}:
        return 1
    raise ValueError(f"Unknown eigenstate label: {label}")


def basis_for_label(label: str) -> Basis:
    """Return Z/X/Y basis for an eigenstate label."""
    try:
        return LABEL_BASIS[label]
    except KeyError as exc:
        raise ValueError(f"Unknown eigenstate label: {label}") from exc


def random_eigenstate(rng: np.random.Generator, basis: Basis | None = None) -> tuple[str, np.ndarray, Basis]:
    """Sample a uniformly random eigenstate from one basis or from all six."""
    if basis is None:
        basis = str(rng.choice(np.array(["Z", "X", "Y"], dtype=object)))
    labels = BASIS_LABELS[basis]
    label = str(rng.choice(np.array(labels, dtype=object)))
    return label, state_for_label(label), basis


def measure_projectively(
    state: np.ndarray,
    basis: Basis,
    rng: np.random.Generator | None = None,
) -> int:
    """Perform a projective measurement in the Pauli basis and return 0 or 1."""
    if rng is None:
        rng = np.random.default_rng()
    state = _normalize(state)
    labels = BASIS_LABELS[basis]
    probs = np.array([abs(np.vdot(state_for_label(lbl), state)) ** 2 for lbl in labels], dtype=float)
    probs /= probs.sum()
    return int(rng.choice([0, 1], p=probs))


def measurement_probabilities(state: np.ndarray, basis: Basis) -> tuple[float, float]:
    """Return probabilities for the two projective outcomes."""
    state = _normalize(state)
    labels = BASIS_LABELS[basis]
    probs = np.array([abs(np.vdot(state_for_label(lbl), state)) ** 2 for lbl in labels], dtype=float)
    probs /= probs.sum()
    return float(probs[0]), float(probs[1])


def random_bloch_state(rng: np.random.Generator) -> np.ndarray:
    """Return a random pure qubit state sampled uniformly on the Bloch sphere."""
    u = rng.random()
    v = rng.random()
    theta = 2.0 * np.arccos(np.sqrt(1.0 - u))
    phi = 2.0 * np.pi * v
    return np.array([
        np.cos(theta / 2.0),
        np.exp(1j * phi) * np.sin(theta / 2.0),
    ], dtype=complex)
