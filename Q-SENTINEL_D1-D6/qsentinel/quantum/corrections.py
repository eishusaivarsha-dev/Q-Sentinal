"""Pauli correction operators used by teleportation."""

from __future__ import annotations

import numpy as np

I = np.eye(2, dtype=complex)
X = np.array([[0, 1], [1, 0]], dtype=complex)
Z = np.array([[1, 0], [0, -1]], dtype=complex)
XZ = X @ Z

CORRECTIONS: dict[str, np.ndarray] = {
    "I": I,
    "X": X,
    "Z": Z,
    "XZ": XZ,
}


def correction_from_bits(bits: str | tuple[int, int]) -> str:
    """Map the two BSM bits to I, X, Z, or XZ."""
    if isinstance(bits, tuple):
        bits = "".join(str(int(b)) for b in bits)
    table = {"00": "I", "01": "X", "10": "Z", "11": "XZ"}
    try:
        return table[bits]
    except KeyError as exc:
        raise ValueError(f"Invalid BSM bits: {bits}") from exc


def apply_correction(state: np.ndarray, correction: str) -> np.ndarray:
    """Apply a named Pauli correction to a qubit state."""
    if correction not in CORRECTIONS:
        raise ValueError(f"Unknown correction {correction}")
    out = CORRECTIONS[correction] @ np.asarray(state, dtype=complex)
    return out / np.linalg.norm(out)
