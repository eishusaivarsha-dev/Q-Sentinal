"""Hybrid key encapsulation: X25519 + ML-KEM-768 (FIPS 203).

Why hybrid: ML-KEM is new, and X25519 is well-studied but quantum-breakable. The combined
secret stays safe as long as EITHER holds. This is the same design as the X25519MLKEM768 group
now used by default in browsers and OpenSSL 3.5.

Combiner: HKDF-SHA3-256 over (ss_mlkem || ss_x25519), bound to both ciphertexts and both
public keys, so an attacker cannot mix and match components. It follows the concatenation
approach of the IETF hybrid-design draft; it is NOT a byte-compatible X-Wing implementation.

ML-KEM backend, in order: native ML-KEM from `cryptography` (OpenSSL 3.5+/4.x, constant-time),
liboqs-python (`.[pqc]`), then pure-Python `kyber-py` (fine for dev/demo, NOT constant-time).
All are FIPS 203 and interoperate.
"""

from __future__ import annotations

from dataclasses import dataclass

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

X_LEN = 32
INFO = b"QSENTINEL-hybrid-kem-v1"


def _mlkem():
    try:
        from cryptography.hazmat.primitives.asymmetric import mlkem
        mlkem.MLKEM768PrivateKey.generate()

        class _Native:
            name = "openssl"

            @staticmethod
            def keygen():
                dk = mlkem.MLKEM768PrivateKey.generate()
                return dk.public_key().public_bytes_raw(), dk

            @staticmethod
            def encaps(ek):
                return mlkem.MLKEM768PublicKey.from_public_bytes(ek).encapsulate()   # (ss, ct)

            @staticmethod
            def decaps(dk, ct):
                return dk.decapsulate(ct)
        return _Native
    except Exception:  # ImportError or UnsupportedAlgorithm on an older OpenSSL
        pass
    try:
        import oqs

        class _Oqs:
            name = "liboqs"

            @staticmethod
            def keygen():
                k = oqs.KeyEncapsulation("ML-KEM-768")
                return k.generate_keypair(), k.export_secret_key()

            @staticmethod
            def encaps(ek):
                with oqs.KeyEncapsulation("ML-KEM-768") as k:
                    ct, ss = k.encap_secret(ek)
                    return ss, ct

            @staticmethod
            def decaps(dk, ct):
                with oqs.KeyEncapsulation("ML-KEM-768", dk) as k:
                    return k.decap_secret(ct)
        return _Oqs
    except (ImportError, RuntimeError, SystemExit):
        from kyber_py.ml_kem import ML_KEM_768

        class _Py:
            name = "kyber-py"
            keygen = staticmethod(ML_KEM_768.keygen)          # -> (ek, dk)
            encaps = staticmethod(ML_KEM_768.encaps)          # -> (ss, ct)

            @staticmethod
            def decaps(dk, ct):
                return ML_KEM_768.decaps(dk, ct)
        return _Py


_KEM = _mlkem()


def _raw(pub: X25519PublicKey) -> bytes:
    return pub.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)


def _combine(ss_pq: bytes, ss_x: bytes, ct: bytes, pk: bytes) -> bytes:
    return HKDF(algorithm=hashes.SHA3_256(), length=32, salt=None,
                info=INFO + ct + pk).derive(ss_pq + ss_x)


@dataclass
class HybridKeyPair:
    public_key: bytes      # x25519_pub (32) || mlkem_ek (1184)
    _x_secret: X25519PrivateKey
    _pq_secret: bytes


def keygen() -> HybridKeyPair:
    xs = X25519PrivateKey.generate()
    ek, dk = _KEM.keygen()
    return HybridKeyPair(_raw(xs.public_key()) + ek, xs, dk)


def encapsulate(public_key: bytes) -> tuple[bytes, bytes]:
    """-> (shared_secret 32 bytes, ciphertext = x25519_ephemeral (32) || mlkem_ct (1088))."""
    peer_x = X25519PublicKey.from_public_bytes(public_key[:X_LEN])
    eph = X25519PrivateKey.generate()
    ss_x = eph.exchange(peer_x)
    ss_pq, ct_pq = _KEM.encaps(public_key[X_LEN:])
    ct = _raw(eph.public_key()) + ct_pq
    return _combine(ss_pq, ss_x, ct, public_key), ct


def decapsulate(kp: HybridKeyPair, ciphertext: bytes) -> bytes:
    ss_x = kp._x_secret.exchange(X25519PublicKey.from_public_bytes(ciphertext[:X_LEN]))
    ss_pq = _KEM.decaps(kp._pq_secret, ciphertext[X_LEN:])
    return _combine(ss_pq, ss_x, ciphertext, kp.public_key)


def implementation() -> str:
    return f"X25519 + ML-KEM-768 ({_KEM.name})"
