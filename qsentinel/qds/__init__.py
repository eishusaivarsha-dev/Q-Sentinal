"""L1 - QDS protocol engine. OWNER: Quantum Lead (+ Backend).

KeyGen -> teleportation-based public-key distribution -> Sign -> Verify.
Message binding is Lamport-style: one pair of one-time key blocks per digest bit.
"""

from .keys import KeyAlreadyUsedError, PrivateKey, PublicKeyHandle
from .protocol import (
    Signature,
    VerificationTranscript,
    distribute,
    keygen,
    message_digest,
    sign,
    verify,
)

__all__ = [
    "KeyAlreadyUsedError", "PrivateKey", "PublicKeyHandle", "Signature",
    "VerificationTranscript", "distribute", "keygen", "message_digest", "sign", "verify",
]
