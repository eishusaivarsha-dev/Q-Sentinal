"""Adapters from D3 verification results into the D4 evidence model."""

from __future__ import annotations

from qsentinel.qds.models import VerificationResult
from .models import DetectionEvidence


def evidence_from_verification(
    result: VerificationResult,
    *,
    basis_commitment: str,
    expected_basis_commitment: str,
    pair_ids: tuple[str, ...],
    expected_pair_ids: tuple[str, ...],
    bsm_counts: dict[str, int] | None = None,
    chsh_value: float | None = None,
    bell_fidelity: float | None = None,
    attack_label: str | None = None,
) -> DetectionEvidence:
    """Create the D4 trust-kernel evidence object from D3 output."""
    return DetectionEvidence(
        observed=tuple(result.observed),
        expected=tuple(result.expected),
        bases=tuple(result.bases),
        verifier_id=result.verifier_id,
        expected_verifier_id=result.verifier_id,
        nonce=result.nonce,
        nonce_already_used=not result.nonce_fresh,
        basis_commitment=basis_commitment,
        expected_basis_commitment=expected_basis_commitment,
        pair_ids=tuple(pair_ids),
        expected_pair_ids=tuple(expected_pair_ids),
        bsm_counts=bsm_counts or {},
        chsh_value=chsh_value,
        bell_fidelity=bell_fidelity,
        message_digest_ok=result.message_binding_ok,
        attack_label=attack_label,
    )
