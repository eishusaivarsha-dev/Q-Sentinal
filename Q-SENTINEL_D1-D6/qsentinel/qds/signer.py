"""QDS signing operations."""

from __future__ import annotations

import hashlib
import secrets

from .models import PrivateKey, PublicKeyMaterial, Signature


def digest_message(message: str | bytes) -> str:
    raw = message.encode() if isinstance(message, str) else message
    return hashlib.sha256(raw).hexdigest()


def sign(
    message: str | bytes,
    private_key: PrivateKey,
    public_key: PublicKeyMaterial,
    nonce: str | None = None,
) -> Signature:
    """Create a signature envelope binding the message, basis commitment, and pair provenance."""
    if public_key.verifier_id != private_key.verifier_id:
        raise ValueError("Public/private verifier identity mismatch")
    if tuple(public_key.pair_ids) != tuple(private_key.pair_ids):
        raise ValueError("Public key pair provenance mismatch")
    nonce = nonce or secrets.token_hex(16)
    return Signature(
        message_digest=digest_message(message),
        basis_commitment=public_key.basis_commitment,
        nonce=nonce,
        verifier_id=private_key.verifier_id,
        pair_ids=tuple(private_key.pair_ids),
    )
