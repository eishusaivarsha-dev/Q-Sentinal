"""Common attack models and deterministic random context."""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Callable

import numpy as np

from qsentinel.qds.models import PublicKeyMaterial, VerifierKey, Signature


@dataclass(frozen=True)
class AttackContext:
    seed: int = 2026
    strength: float = 1.0

    def rng(self) -> np.random.Generator:
        return np.random.default_rng(self.seed)


@dataclass
class AttackScenario:
    name: str
    description: str
    public_key: PublicKeyMaterial
    signature: Signature
    verifier_key: VerifierKey
    chsh_value: float = 2.828
    bell_fidelity: float = 0.99
    bsm_counts: dict[str, int] | None = None
    expected_detector: str = "D1"
    source_identity: str | None = None
    message_digest_ok: bool = True


ATTACK_DETECTOR_MAP: dict[str, str] = {
    "blind_forgery": "D2",
    "known_basis_partial_forgery": "D1",
    "intercept_resend": "D4",
    "entangle_and_measure": "D3",
    "replay": "D5",
    "mitm_classical": "D6",
    "repudiation": "D6",
}


def clone_scenario(base: AttackScenario) -> AttackScenario:
    return replace(
        base,
        public_key=base.public_key.clone(),
        bsm_counts=dict(base.bsm_counts or {}),
    )
