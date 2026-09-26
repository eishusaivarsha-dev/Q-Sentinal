"""High-level protocol facade for D3 integration."""

from __future__ import annotations

from dataclasses import dataclass

from qsentinel.quantum.backends import QuantumBackend, IdealBackend
from .keygen import generate_keypair, distribute_public_key
from .models import PrivateKey, VerifierKey, PublicKeyMaterial, Signature, VerificationResult
from .signer import sign
from .verifier import verify


@dataclass
class QDSProtocol:
    """Convenience facade combining D2 and D3 operations."""

    rounds: int = 128
    seed: int = 2026
    verifier_id: str = "verifier-01"
    backend: QuantumBackend | None = None
    private_key: PrivateKey | None = None
    verifier_key: VerifierKey | None = None
    public_key: PublicKeyMaterial | None = None

    def setup(self) -> None:
        self.backend = self.backend or IdealBackend()
        self.private_key, self.verifier_key = generate_keypair(
            rounds=self.rounds,
            seed=self.seed,
            verifier_id=self.verifier_id,
        )
        self.public_key = distribute_public_key(self.private_key, backend=self.backend)

    def sign(self, message: str | bytes, nonce: str | None = None) -> Signature:
        self._assert_ready()
        assert self.private_key is not None and self.public_key is not None
        return sign(message, self.private_key, self.public_key, nonce=nonce)

    def verify(self, message: str | bytes, signature: Signature, *, nonce_already_used: bool = False) -> VerificationResult:
        self._assert_ready()
        assert self.public_key is not None and self.verifier_key is not None
        return verify(
            message,
            signature,
            self.public_key,
            self.verifier_key,
            nonce_already_used=nonce_already_used,
        )

    def _assert_ready(self) -> None:
        if self.private_key is None or self.verifier_key is None or self.public_key is None:
            raise RuntimeError("Call setup() before using the protocol")
