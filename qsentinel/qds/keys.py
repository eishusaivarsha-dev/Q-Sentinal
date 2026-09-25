"""One-time QDS keys.

Private key: for each digest bit i (L of them) and each bit value h in {0,1}, a block of n
(basis, value) pairs selecting Pauli eigenstates. Revealing a block during signing burns it,
so every key signs exactly ONE message (enforced by `used`).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


class KeyAlreadyUsedError(RuntimeError):
    """QDS keys are one-time: reusing one leaks its bases and enables forgery."""


@dataclass
class PrivateKey:
    key_id: str
    signer_id: str
    bases: np.ndarray    # (L, 2, n) uint8, values in the configured basis set
    values: np.ndarray   # (L, 2, n) uint8
    used: bool = False

    @property
    def shape(self) -> tuple[int, int]:
        L, _, n = self.bases.shape
        return L, n


@dataclass
class PublicKeyHandle:
    """A verifier's copy of the quantum public key.

    In the simulator the "quantum memory" holding the teleported eigenstates is represented by
    the preparation record below. Verifier-side code must ONLY touch it through a
    QuantumBackend (i.e. by measuring), never read it directly - `_states` is private for a reason.

    TODO(quantum-lead): add measure-on-receipt mode (no quantum memory; Dunjko/Wallden/Andersson)
    where the verifier measures each qubit on arrival in a random basis and stores only
    (basis, outcome) - the hardware-realistic variant.
    """

    key_id: str
    signer_id: str
    verifier_id: str
    _states: tuple[np.ndarray, np.ndarray] = field(repr=False)

    @property
    def shape(self) -> tuple[int, int]:
        L, _, n = self._states[0].shape
        return L, n
