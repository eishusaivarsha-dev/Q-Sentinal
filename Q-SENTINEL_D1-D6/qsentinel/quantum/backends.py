"""Pluggable quantum backends for D2."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

import numpy as np

from .bsm import sample_bsm, sample_bsm_qiskit
from .teleportation import TeleportationResult, build_teleportation_circuit, teleport


class QuantumBackend(ABC):
    """Backend interface consumed by higher protocol layers."""

    name: str = "abstract"

    @abstractmethod
    def teleport(self, state: np.ndarray, rng: np.random.Generator | None = None) -> TeleportationResult:
        """Teleport a single qubit state."""

    @abstractmethod
    def bsm_counts(self, shots: int, rng: np.random.Generator | None = None) -> dict[str, int]:
        """Return BSM outcome counts."""

    def teleportation_circuit(self, state: np.ndarray | None = None):
        """Return a circuit representation when the backend supports one."""
        return build_teleportation_circuit(state)


class IdealBackend(QuantumBackend):
    name = "ideal"

    def teleport(self, state: np.ndarray, rng: np.random.Generator | None = None) -> TeleportationResult:
        return teleport(state, rng=rng, depolarizing_probability=0.0)

    def bsm_counts(self, shots: int, rng: np.random.Generator | None = None) -> dict[str, int]:
        return sample_bsm(shots, rng=rng)


class NoisyBackend(QuantumBackend):
    name = "noisy"

    def __init__(self, depolarizing_probability: float = 0.02) -> None:
        self.depolarizing_probability = float(depolarizing_probability)
        if not 0.0 <= self.depolarizing_probability <= 1.0:
            raise ValueError("depolarizing_probability must be in [0,1]")

    def teleport(self, state: np.ndarray, rng: np.random.Generator | None = None) -> TeleportationResult:
        return teleport(state, rng=rng, depolarizing_probability=self.depolarizing_probability)

    def bsm_counts(self, shots: int, rng: np.random.Generator | None = None) -> dict[str, int]:
        counts = sample_bsm(shots, rng=rng)
        if self.depolarizing_probability <= 0:
            return counts
        rng = rng or np.random.default_rng()
        p = self.depolarizing_probability
        total = sum(counts.values())
        expected = np.array([counts[k] for k in ("00", "01", "10", "11")], dtype=float)
        expected = (1.0 - p) * expected + p * (total / 4.0)
        sampled = rng.multinomial(total, expected / expected.sum())
        return {k: int(v) for k, v in zip(("00", "01", "10", "11"), sampled)}


class QiskitAerBackend(QuantumBackend):
    """Aer-backed circuit sampler.

    The BSM measurement is executed by Qiskit Aer. The portable NumPy path is
    still used for the returned state-vector fidelity so downstream code keeps
    one stable result model regardless of simulator availability.
    """

    name = "qiskit-aer"

    def __init__(self, shots: int = 4096, seed_simulator: int = 2026) -> None:
        try:
            from qiskit_aer import AerSimulator
        except ImportError as exc:
            raise ImportError("Install qiskit and qiskit-aer to use QiskitAerBackend") from exc
        self._AerSimulator = AerSimulator
        self.shots = int(shots)
        self.seed_simulator = int(seed_simulator)

    def teleport(self, state: np.ndarray, rng: np.random.Generator | None = None) -> TeleportationResult:
        # Keep a mathematically exact state-level reference result while also
        # constructing the actual dynamic Qiskit circuit for this backend.
        result = teleport(state, rng=rng)
        _ = self.teleportation_circuit(np.asarray(state, dtype=complex))
        return result

    def bsm_counts(self, shots: int, rng: np.random.Generator | None = None) -> dict[str, int]:
        seed = self.seed_simulator if rng is None else int(rng.integers(0, 2**31 - 1))
        # A fixed |0> input is sufficient: the BSM outcomes of standard
        # teleportation with |Phi+> are uniformly distributed for every input.
        return sample_bsm_qiskit(shots, state=np.array([1.0, 0.0], dtype=complex), seed_simulator=seed)

    def teleportation_circuit(self, state: np.ndarray | None = None):
        return build_teleportation_circuit(state, dynamic_corrections=True)


class HardwareBackend(QuantumBackend):
    """Integration boundary for a future IBM Quantum Runtime backend."""

    name = "hardware"

    def teleport(self, state: np.ndarray, rng: np.random.Generator | None = None) -> TeleportationResult:
        raise NotImplementedError(
            "HardwareBackend is an integration boundary. Add qiskit-ibm-runtime "
            "authentication and backend selection during hardware validation."
        )

    def bsm_counts(self, shots: int, rng: np.random.Generator | None = None) -> dict[str, int]:
        raise NotImplementedError("HardwareBackend BSM execution is not configured.")
