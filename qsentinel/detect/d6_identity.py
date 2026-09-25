"""D6 - Identity Binding Monitor (impersonation, unauthorised verification).

TODO(security-lead): entanglement-pair provenance binding (which Bell-pair batch was issued
to which verifier) and mTLS identity from the API layer.
"""

from .base import DetectionContext, DetectorResult, Severity


def run(ctx: DetectionContext) -> DetectorResult:
    sig, pub, ids = ctx.signature, ctx.pubkey, ctx.identities
    problems = []
    owner = ids.key_owner.get(sig.key_id)
    if owner is None:
        problems.append(f"key {sig.key_id} was never issued")
    elif owner != sig.signer_id:
        problems.append(f"key belongs to {owner!r}, signature claims {sig.signer_id!r}")
    if pub.key_id != sig.key_id:
        problems.append("signature key_id does not match verifier's public key")
    if pub.verifier_id not in ids.authorised_verifiers:
        problems.append(f"verifier {pub.verifier_id!r} not authorised (RBAC)")
    return DetectorResult(
        detector="D6", name="Identity Binding Monitor", alert=bool(problems),
        severity=Severity.CRITICAL if problems else Severity.INFO,
        statistic=None, threshold=None,
        detail="; ".join(problems) if problems else "signer, key and verifier bindings valid",
    )
