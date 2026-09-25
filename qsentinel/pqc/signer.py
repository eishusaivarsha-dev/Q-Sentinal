"""ML-DSA-65 (FIPS 204) signing.

Implementation, picked automatically in this order (override with QSENTINEL_PQC_IMPL):
  1. "openssl"      - native ML-DSA from `cryptography` (OpenSSL 3.5+ / 4.x). Constant-time,
                      ~0.6 ms per signature. Used whenever the installed build supports it.
  2. "liboqs"       - liboqs-python (`pip install -e .[pqc]`, needs the liboqs C library).
  3. "dilithium-py" - pure Python. Fine for development, ~200x slower, NOT constant-time.
All three produce standard FIPS 204 signatures, so any one can verify another's.

TODO(security-lead): Vault/SoftHSM key custody.
"""

from __future__ import annotations

import os

IMPLS = ("openssl", "liboqs", "dilithium-py")


def _available(impl: str) -> bool:
    try:
        if impl == "openssl":
            from cryptography.hazmat.primitives.asymmetric import mldsa
            mldsa.MLDSA65PrivateKey.generate()
        elif impl == "liboqs":
            import oqs  # noqa: F401
        else:
            from dilithium_py.ml_dsa import ML_DSA_65  # noqa: F401
        return True
    except Exception:  # ImportError, UnsupportedAlgorithm (old OpenSSL), liboqs load errors
        return False


def pick_implementation() -> str:
    forced = os.environ.get("QSENTINEL_PQC_IMPL")
    if forced:
        if forced not in IMPLS or not _available(forced):
            raise RuntimeError(f"QSENTINEL_PQC_IMPL={forced!r} is not available")
        return forced
    return next(i for i in IMPLS if _available(i))


class MLDSASigner:
    """Keys: `public_key` is the raw 1952-byte FIPS 204 key. The secret is implementation-specific
    (a 32-byte seed for "openssl", the expanded key for the others)."""

    algorithm = "ML-DSA-65"

    def __init__(self, public_key: bytes | None = None, secret_key: bytes | None = None,
                 implementation: str | None = None):
        self._impl = implementation or pick_implementation()
        if public_key is None:
            public_key, secret_key = self._keygen()
        self.public_key = public_key
        self._secret_key = secret_key

    @property
    def implementation(self) -> str:
        return self._impl

    def _keygen(self) -> tuple[bytes, bytes]:
        if self._impl == "openssl":
            from cryptography.hazmat.primitives.asymmetric import mldsa
            sk = mldsa.MLDSA65PrivateKey.generate()
            return sk.public_key().public_bytes_raw(), sk.private_bytes_raw()
        if self._impl == "liboqs":
            import oqs
            with oqs.Signature(self.algorithm) as s:
                pk = s.generate_keypair()
                return pk, s.export_secret_key()
        from dilithium_py.ml_dsa import ML_DSA_65
        return ML_DSA_65.keygen()

    def sign(self, message: bytes) -> bytes:
        if self._secret_key is None:
            raise ValueError("verify-only signer")
        if self._impl == "openssl":
            from cryptography.hazmat.primitives.asymmetric import mldsa
            return mldsa.MLDSA65PrivateKey.from_seed_bytes(self._secret_key).sign(message)
        if self._impl == "liboqs":
            import oqs
            with oqs.Signature(self.algorithm, self._secret_key) as s:
                return s.sign(message)
        from dilithium_py.ml_dsa import ML_DSA_65
        return ML_DSA_65.sign(self._secret_key, message)

    def verify(self, message: bytes, signature: bytes, public_key: bytes | None = None) -> bool:
        pk = public_key or self.public_key
        if self._impl == "openssl":
            from cryptography.exceptions import InvalidSignature
            from cryptography.hazmat.primitives.asymmetric import mldsa
            try:
                mldsa.MLDSA65PublicKey.from_public_bytes(pk).verify(signature, message)
                return True
            except (InvalidSignature, ValueError):
                return False
        if self._impl == "liboqs":
            import oqs
            with oqs.Signature(self.algorithm) as s:
                return s.verify(message, signature, pk)
        from dilithium_py.ml_dsa import ML_DSA_65
        return ML_DSA_65.verify(pk, message, signature)
