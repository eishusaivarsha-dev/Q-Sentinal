"""Backend interface shared by all quantum simulators / hardware."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

import numpy as np


@dataclass(frozen=True)
class ChannelModel:
    """What happens to the verifier's half of each Bell pair while in transit.

    depolarizing:       honest channel noise (prob. of a random Pauli error)
    intercept_fraction: fraction of pairs an eavesdropper measures and resends (attack)
    eve_bases:          bases the eavesdropper picks from (0=Z, 1=X, 2=Y)
    """

    depolarizing: float = 0.0
    intercept_fraction: float = 0.0
    eve_bases: tuple[int, ...] = (0, 1, 2)


@dataclass
class RoundResult:
    outcomes: np.ndarray                 # (n,) verifier measurement bits
    bsm: np.ndarray                      # (n, 2) signer Bell-state-measurement bits (m0, m1)
    attacked: np.ndarray = field(default_factory=lambda: np.zeros(0, dtype=bool))


class QuantumBackend(Protocol):
    name: str

    def teleport_and_measure(
        self,
        prep_bases: np.ndarray,
        prep_values: np.ndarray,
        meas_bases: np.ndarray,
        channel: ChannelModel,
        seed: int,
    ) -> RoundResult:
        """For each round i: signer prepares eigenstate (prep_bases[i], prep_values[i]),
        teleports it over a shared |Phi+> pair through `channel`, verifier applies the
        Pauli correction {I, X, Z, XZ} and measures in meas_bases[i]."""
        ...

    def bell_correlators(self, n_pairs: int, channel: ChannelModel, seed: int) -> dict[str, float]:
        """Sacrificial Bell pairs -> estimates of <XX>, <YY>, <ZZ> (used by detector D3)."""
        ...


def get_backend(name: str = "stim") -> QuantumBackend:
    if name == "stim":
        from .stim_backend import StimBackend

        return StimBackend()
    if name == "qiskit":
        from .qiskit_backend import QiskitAerBackend

        return QiskitAerBackend()
    if name == "ibm":
        from .ibm_backend import IBMHardwareBackend

        return IBMHardwareBackend()
    raise ValueError(f"unknown backend {name!r}")
