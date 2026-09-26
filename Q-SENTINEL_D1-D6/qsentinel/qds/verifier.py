"""Projective verification for the reference QDS engine."""

from __future__ import annotations

import numpy as np

from qsentinel.quantum.measurements import mismatch_count
from qsentinel.quantum.states import measure_projectively
from .models import PublicKeyMaterial, Signature, VerificationResult, VerifierKey
from .signer import digest_message


def verify(
    message: str | bytes,
    signature: Signature,
    public_key: PublicKeyMaterial,
    verifier_key: VerifierKey,
    *,
    rng: np.random.Generator | None = None,
    nonce_already_used: bool = False,
    mismatch_threshold: int = 0,
) -> VerificationResult:
    """Verify a signature via projective measurements and closed-form predicates."""
    rng = rng or np.random.default_rng()
    message_digest = digest_message(message)
    message_binding_ok = signature.message_digest == message_digest
    identity_ok = signature.verifier_id == verifier_key.verifier_id == public_key.verifier_id
    basis_commitment_ok = (
        signature.basis_commitment == verifier_key.basis_commitment == public_key.basis_commitment
    )
    pair_provenance_ok = (
        tuple(signature.pair_ids) == tuple(verifier_key.pair_ids) == tuple(public_key.pair_ids)
    )
    nonce_fresh = not nonce_already_used

    expected = list(verifier_key.expected_outcomes)
    bases = list(verifier_key.bases)
    if len(public_key.states) != len(expected):
        raise ValueError("Public key state count does not match verifier key")
    if tuple(public_key.pair_ids) != tuple(verifier_key.pair_ids):
        raise ValueError("Public key pair provenance does not match verifier key")

    observed = [
        measure_projectively(state, basis, rng=rng)
        for state, basis in zip(public_key.states, bases)
    ]
    mismatches = mismatch_count(observed, expected)

    accepted = (
        message_binding_ok
        and identity_ok
        and basis_commitment_ok
        and pair_provenance_ok
        and nonce_fresh
        and mismatches <= mismatch_threshold
    )

    transcript = {
        "message_digest": message_digest,
        "signature_message_digest": signature.message_digest,
        "mismatches": mismatches,
        "mismatch_threshold": mismatch_threshold,
        "rounds": len(expected),
        "nonce": signature.nonce,
        "nonce_fresh": nonce_fresh,
        "verifier_id": verifier_key.verifier_id,
        "basis_commitment": signature.basis_commitment,
        "basis_commitment_ok": basis_commitment_ok,
        "pair_provenance_ok": pair_provenance_ok,
        "identity_ok": identity_ok,
        "source_backend": public_key.source_backend,
        "teleportation_fidelity_min": min(public_key.teleportation_fidelities, default=1.0),
    }
    return VerificationResult(
        accepted=accepted,
        message_digest=message_digest,
        verifier_id=verifier_key.verifier_id,
        nonce=signature.nonce,
        observed=observed,
        expected=expected,
        bases=bases,
        mismatches=mismatches,
        rounds=len(expected),
        basis_commitment_ok=basis_commitment_ok,
        message_binding_ok=message_binding_ok,
        pair_provenance_ok=pair_provenance_ok,
        identity_ok=identity_ok,
        nonce_fresh=nonce_fresh,
        transcript=transcript,
    )
