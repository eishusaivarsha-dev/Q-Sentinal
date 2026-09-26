"""Reference and circuit-level teleportation engine."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np

from .corrections import CORRECTIONS, apply_correction, correction_from_bits


@dataclass(frozen=True)
class TeleportationResult:
    input_state: np.ndarray
    bsm_bits: str
    correction: str
    raw_output_state: np.ndarray
    corrected_state: np.ndarray
    fidelity: float
    channel_error: str | None = None


def build_teleportation_circuit(
    state: Sequence[complex] | None = None,
    *,
    dynamic_corrections: bool = True,
):
    """Build the standard three-qubit teleportation circuit using Qiskit.

    q0 is the input, q1-q2 are the shared |Phi+> pair. The two BSM bits are
    measured into a two-bit classical register. When ``dynamic_corrections``
    is true, Qiskit's ``if_test`` control flow applies X/Z corrections to q2.
    """
    try:
        from qiskit import QuantumCircuit
    except ImportError as exc:
        raise ImportError("Qiskit is required for build_teleportation_circuit()") from exc

    qc = QuantumCircuit(3, 2)
    if state is not None:
        vec = np.asarray(state, dtype=complex)
        if vec.shape != (2,):
            raise ValueError("state must be a length-2 vector")
        norm = np.linalg.norm(vec)
        if norm == 0:
            raise ValueError("state cannot be the zero vector")
        vec = vec / norm
        qc.initialize(vec.tolist(), 0)

    qc.h(1)
    qc.cx(1, 2)
    qc.cx(0, 1)
    qc.h(0)
    qc.measure(0, 0)
    qc.measure(1, 1)

    if dynamic_corrections:
        # c0 is the least-significant classical bit. Thus values 1,2,3 map
        # to BSM bit strings 01,10,11 respectively.
        with qc.if_test((qc.clbits[0], 1)):
            qc.x(2)
        with qc.if_test((qc.clbits[1], 1)):
            qc.z(2)

    return qc


def _random_bsm_bits(rng: np.random.Generator) -> str:
    return str(rng.choice(np.array(["00", "01", "10", "11"], dtype=object)))


def teleport(
    state: np.ndarray,
    rng: np.random.Generator | None = None,
    depolarizing_probability: float = 0.0,
) -> TeleportationResult:
    """Simulate a teleportation round with explicit BSM outcome and correction."""
    rng = rng or np.random.default_rng()
    state = np.asarray(state, dtype=complex)
    if state.shape != (2,):
        raise ValueError("Teleportation input must be a length-2 state vector")
    norm = np.linalg.norm(state)
    if norm == 0:
        raise ValueError("Input state cannot be zero")
    state = state / norm
    if not 0.0 <= depolarizing_probability <= 1.0:
        raise ValueError("depolarizing_probability must be in [0,1]")

    bits = _random_bsm_bits(rng)
    correction = correction_from_bits(bits)
    # Before Bob applies the correction, the received state differs by the
    # Pauli associated with the BSM result, up to global phase.
    raw = CORRECTIONS[correction] @ state
    channel_error = None
    if rng.random() < depolarizing_probability:
        channel_error = str(rng.choice(np.array(["X", "Z", "XZ"], dtype=object)))
        raw = CORRECTIONS[channel_error] @ raw

    corrected = apply_correction(raw, correction)
    fidelity = float(abs(np.vdot(state, corrected)) ** 2)
    return TeleportationResult(
        input_state=state,
        bsm_bits=bits,
        correction=correction,
        raw_output_state=raw,
        corrected_state=corrected,
        fidelity=fidelity,
        channel_error=channel_error,
    )
