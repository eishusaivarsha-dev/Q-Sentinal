"""Bell-state measurement utilities and Qiskit circuit construction."""

from __future__ import annotations

from collections import Counter
from typing import Sequence

import numpy as np


def sample_bsm(shots: int, rng: np.random.Generator | None = None) -> dict[str, int]:
    """Sample ideal BSM outcomes 00/01/10/11 uniformly."""
    if shots <= 0:
        raise ValueError("shots must be positive")
    rng = rng or np.random.default_rng()
    values = rng.choice(np.array(["00", "01", "10", "11"], dtype=object), size=shots)
    counter = Counter(values.tolist())
    return {key: int(counter.get(key, 0)) for key in ("00", "01", "10", "11")}


def normalized_bsm_distribution(counts: dict[str, int]) -> dict[str, float]:
    """Normalize four-outcome BSM counts."""
    keys = ("00", "01", "10", "11")
    total = sum(int(counts.get(k, 0)) for k in keys)
    if total <= 0:
        raise ValueError("BSM counts must contain at least one shot")
    return {k: float(counts.get(k, 0)) / total for k in keys}


def build_bsm_sampling_circuit(
    state: Sequence[complex] | None = None,
):
    """Build a Qiskit teleportation circuit that measures only the BSM bits.

    The input state lives on q0 and the Bell pair on q1-q2.  The first two
    qubits are measured in the Bell basis.  For a maximally entangled resource,
    all four BSM outcomes occur with probability 1/4 for any normalized input
    qubit state.
    """
    try:
        from qiskit import QuantumCircuit
    except ImportError as exc:
        raise ImportError("Qiskit is required for build_bsm_sampling_circuit()") from exc

    qc = QuantumCircuit(3, 2)
    if state is not None:
        vec = np.asarray(state, dtype=complex)
        if vec.shape != (2,):
            raise ValueError("state must be a length-2 vector")
        if not np.isclose(np.linalg.norm(vec), 1.0):
            vec = vec / np.linalg.norm(vec)
        qc.initialize(vec.tolist(), 0)

    # Bell resource |Phi+> on q1,q2.
    qc.h(1)
    qc.cx(1, 2)
    # Bell-state measurement on q0,q1.
    qc.cx(0, 1)
    qc.h(0)
    qc.measure(0, 0)
    qc.measure(1, 1)
    return qc


def build_bsm_circuit(state: Sequence[complex] | None = None):
    """Backward-compatible alias for the BSM circuit constructor."""
    return build_bsm_sampling_circuit(state)


def sample_bsm_qiskit(
    shots: int,
    *,
    state: Sequence[complex] | None = None,
    seed_simulator: int = 2026,
) -> dict[str, int]:
    """Sample BSM outcomes with Qiskit Aer when installed."""
    if shots <= 0:
        raise ValueError("shots must be positive")
    try:
        from qiskit_aer import AerSimulator
    except ImportError as exc:
        raise ImportError("Install qiskit and qiskit-aer to use sample_bsm_qiskit()") from exc

    backend = AerSimulator()
    qc = build_bsm_sampling_circuit(state)
    result = backend.run(qc, shots=shots, seed_simulator=seed_simulator).result()
    raw = result.get_counts(qc)
    counts = {k: 0 for k in ("00", "01", "10", "11")}
    for key, value in raw.items():
        bits = str(key).replace(" ", "")
        counts[bits] = counts.get(bits, 0) + int(value)
    return counts
