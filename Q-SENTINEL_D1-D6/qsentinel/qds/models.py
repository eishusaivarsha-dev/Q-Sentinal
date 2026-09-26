"""Typed models for the D3 QDS engine."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np


@dataclass(frozen=True)
class PrivateKey:
    seed: int
    bases: tuple[str, ...]
    eigenstate_labels: tuple[str, ...]
    verifier_id: str
    pair_ids: tuple[str, ...]


@dataclass(frozen=True)
class VerifierKey:
    verifier_id: str
    bases: tuple[str, ...]
    expected_outcomes: tuple[int, ...]
    basis_commitment: str
    pair_ids: tuple[str, ...]


@dataclass
class PublicKeyMaterial:
    verifier_id: str
    states: list[np.ndarray]
    pair_ids: tuple[str, ...]
    basis_commitment: str
    source_backend: str = "ideal"
    teleportation_fidelities: tuple[float, ...] = ()

    def clone(self) -> "PublicKeyMaterial":
        return PublicKeyMaterial(
            verifier_id=self.verifier_id,
            states=[s.copy() for s in self.states],
            pair_ids=tuple(self.pair_ids),
            basis_commitment=self.basis_commitment,
            source_backend=self.source_backend,
            teleportation_fidelities=tuple(self.teleportation_fidelities),
        )


@dataclass(frozen=True)
class Signature:
    message_digest: str
    basis_commitment: str
    nonce: str
    verifier_id: str
    pair_ids: tuple[str, ...]


@dataclass
class VerificationResult:
    accepted: bool
    message_digest: str
    verifier_id: str
    nonce: str
    observed: list[int]
    expected: list[int]
    bases: list[str]
    mismatches: int
    rounds: int
    basis_commitment_ok: bool
    message_binding_ok: bool
    pair_provenance_ok: bool
    identity_ok: bool
    nonce_fresh: bool
    transcript: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "accepted": self.accepted,
            "message_digest": self.message_digest,
            "verifier_id": self.verifier_id,
            "nonce": self.nonce,
            "observed": self.observed,
            "expected": self.expected,
            "bases": self.bases,
            "mismatches": self.mismatches,
            "rounds": self.rounds,
            "basis_commitment_ok": self.basis_commitment_ok,
            "message_binding_ok": self.message_binding_ok,
            "pair_provenance_ok": self.pair_provenance_ok,
            "identity_ok": self.identity_ok,
            "nonce_fresh": self.nonce_fresh,
            "transcript": self.transcript,
        }
