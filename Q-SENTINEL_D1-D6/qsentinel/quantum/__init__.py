"""Quantum substrate and teleportation engine (D2)."""

from .states import EIGENSTATES, state_for_label, random_eigenstate, expected_outcome, measure_projectively
from .bell import BELL_STATES, bell_state, phi_plus, bell_fidelity
from .bsm import sample_bsm, normalized_bsm_distribution, build_bsm_circuit, sample_bsm_qiskit
from .teleportation import TeleportationResult, teleport, build_teleportation_circuit
from .backends import QuantumBackend, IdealBackend, NoisyBackend, QiskitAerBackend, HardwareBackend

__all__ = [
    "EIGENSTATES", "state_for_label", "random_eigenstate", "expected_outcome", "measure_projectively",
    "BELL_STATES", "bell_state", "phi_plus", "bell_fidelity",
    "sample_bsm", "normalized_bsm_distribution", "build_bsm_circuit", "sample_bsm_qiskit",
    "TeleportationResult", "teleport", "build_teleportation_circuit",
    "QuantumBackend", "IdealBackend", "NoisyBackend", "QiskitAerBackend", "HardwareBackend",
]
