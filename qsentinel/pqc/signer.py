"""ML-DSA-65 (FIPS 204) signing.

Prefers liboqs-python (`pip install -e .[pqc]`, needs the liboqs C library) and falls back to
the pure-Python `dilithium-py` implementation, which is fine for development and demos but is
NOT constant-time - use liboqs for anything beyond the hackathon.

TODO(security-lead): ML-KEM-768 key exchange + hybrid X25519MLKEM768 TLS (OpenSSL 3.5+),
Vault/SoftHSM key custody.
"""

from __future__ import annotations


class MLDSASigner:
    algorithm = "ML-DSA-65"

    def __init__(self, public_key: bytes | None = None, secret_key: bytes | None = None):
        self._impl = self._load()
        if public_key is None:
            public_key, secret_key = self._keygen()
        self.public_key = public_key
        self._secret_key = secret_key

    @staticmethod
    def _load() -> str:
        try:
            import oqs  # noqa: F401
            return "liboqs"
        except (ImportError, RuntimeError, SystemExit):
            from dilithium_py.ml_dsa import ML_DSA_65  # noqa: F401
            return "dilithium-py"

    @property
    def implementation(self) -> str:
        return self._impl

    def _keygen(self) -> tuple[bytes, bytes]:
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
        if self._impl == "liboqs":
            import oqs
            with oqs.Signature(self.algorithm, self._secret_key) as s:
                return s.sign(message)
        from dilithium_py.ml_dsa import ML_DSA_65
        return ML_DSA_65.sign(self._secret_key, message)

    def verify(self, message: bytes, signature: bytes, public_key: bytes | None = None) -> bool:
        pk = public_key or self.public_key
        if self._impl == "liboqs":
            import oqs
            with oqs.Signature(self.algorithm) as s:
                return s.verify(message, signature, pk)
        from dilithium_py.ml_dsa import ML_DSA_65
        return ML_DSA_65.verify(pk, message, signature)
