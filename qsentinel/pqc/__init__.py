"""Post-quantum classical crypto. OWNER: Security Lead.

  signer.py   ML-DSA-65 signatures (FIPS 204)
  kem.py      hybrid X25519 + ML-KEM-768 key encapsulation (FIPS 203)
  channel.py  mutually authenticated AEAD channel with replay/reorder protection

Rule: no RSA / classical-only ECDSA anywhere in the trust path (D9 acceptance criterion).
"""

from .channel import ChannelError, SecureChannel, connect
from .signer import MLDSASigner

__all__ = ["ChannelError", "MLDSASigner", "SecureChannel", "connect"]
