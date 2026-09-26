"""Key generation and teleportation-based public-key distribution."""

from __future__ import annotations

import hashlib
import json
from typing import Iterable

import numpy as np

from qsentinel.quantum.backends import IdealBackend, QuantumBackend
from qsentinel.quantum.states import BASIS_LABELS, expected_outcome, state_for_label
from .models import PrivateKey, PublicKeyMaterial, VerifierKey


def _basis_commitment(bases: Iterable[str], verifier_id: str) -> str:
    payload = {"verifier_id": verifier_id, "bases": list(bases)}
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def generate_keypair(
    rounds: int = 128,
    seed: int = 2026,
    verifier_id: str = "verifier-01",
) -> tuple[PrivateKey, VerifierKey]:
    """Generate a six-state Pauli-eigenstate sequence."""
    if rounds <= 0:
        raise ValueError("rounds must be positive")
    if not verifier_id:
        raise ValueError("verifier_id must be non-empty")
    rng = np.random.default_rng(seed)
    bases: list[str] = []
    labels: list[str] = []
    pair_ids: list[str] = []
    for idx in range(rounds):
        basis = str(rng.choice(np.array(["Z", "X", "Y"], dtype=object)))
        label = str(rng.choice(np.array(BASIS_LABELS[basis], dtype=object)))
        bases.append(basis)
        labels.append(label)
        pair_ids.append(f"{verifier_id}-pair-{idx:04d}")
    commitment = _basis_commitment(bases, verifier_id)
    private = PrivateKey(
        seed=seed,
        bases=tuple(bases),
        eigenstate_labels=tuple(labels),
        verifier_id=verifier_id,
        pair_ids=tuple(pair_ids),
    )
    verifier = VerifierKey(
        verifier_id=verifier_id,
        bases=tuple(bases),
        expected_outcomes=tuple(expected_outcome(lbl) for lbl in labels),
        basis_commitment=commitment,
        pair_ids=tuple(pair_ids),
    )
    return private, verifier


def distribute_public_key(
    private_key: PrivateKey,
    backend: QuantumBackend | None = None,
) -> PublicKeyMaterial:
    """Teleport each prepared Pauli eigenstate through a selected backend."""
    backend = backend or IdealBackend()
    rng = np.random.default_rng(private_key.seed + 1)
    states: list[np.ndarray] = []
    fidelities: list[float] = []
    for label in private_key.eigenstate_labels:
        state = state_for_label(label)
        result = backend.teleport(state, rng=rng)
        states.append(result.corrected_state)
        fidelities.append(float(result.fidelity))
    commitment = _basis_commitment(private_key.bases, private_key.verifier_id)
    return PublicKeyMaterial(
        verifier_id=private_key.verifier_id,
        states=states,
        pair_ids=private_key.pair_ids,
        basis_commitment=commitment,
        source_backend=backend.name,
        teleportation_fidelities=tuple(fidelities),
    )
