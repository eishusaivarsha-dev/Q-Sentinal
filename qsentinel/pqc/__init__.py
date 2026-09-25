"""Post-quantum classical crypto. OWNER: Security Lead.

Rule: no RSA / ECDSA anywhere in the trust path (D9 acceptance criterion).
"""

from .signer import MLDSASigner

__all__ = ["MLDSASigner"]
