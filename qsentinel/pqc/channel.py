"""Quantum-safe authenticated channel between Q-SENTINEL nodes (signer <-> verifier <-> ledger).

Handshake (two messages):
    1. initiator -> responder: hello = eph_hybrid_pk, ML-DSA-65 signature over it
    2. responder -> initiator: reply = hybrid ciphertext, ML-DSA-65 signature over (hello || ct)
Both sides derive two direction keys with HKDF-SHA3-256 from the hybrid shared secret, bound to
the full handshake transcript. Each side checks the other's ML-DSA signature against a PINNED
identity key, so a man-in-the-middle cannot substitute his own key.

Records: ChaCha20-Poly1305, nonce = 8-byte sequence number, AAD = direction || sequence.
The receiver accepts sequence numbers only in strictly increasing order, so it detects
tampering, replay, reordering and reflection (a record sent back to its own sender).

Why this matters for Q-SENTINEL, beyond the usual transport security:
  * Signatures, verdicts and ledger writes travel over this channel. A MITM is stopped at the
    transport layer before it ever reaches the quantum checks (defence in depth).
  * TELEPORTATION CORRECTION BITS. Teleportation is a quantum one-time pad keyed by the
    signer's two Bell-measurement bits (m0, m1). An eavesdropper who probes the Bell-pair half
    in transit gets a coin flip unless she ALSO reads (m0, m1) (see attacks: info meter).
    Sending the correction bits over this channel means a quantum-only eavesdropper learns
    nothing, but still leaves her disturbance for D3/D4 to detect.
"""

from __future__ import annotations

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from . import kem
from .signer import MLDSASigner

SIG_LEN = 3309   # ML-DSA-65 signature size


class ChannelError(Exception):
    """Authentication, integrity or ordering failure - drop the connection."""


def _keys(ss: bytes, transcript: bytes) -> tuple[bytes, bytes]:
    okm = HKDF(algorithm=hashes.SHA3_256(), length=64, salt=None,
               info=b"QSENTINEL-channel-v1" + transcript).derive(ss)
    return okm[:32], okm[32:]   # initiator->responder, responder->initiator


class SecureChannel:
    def __init__(self, identity: MLDSASigner, peer_identity: bytes, initiator: bool):
        self.identity = identity
        self.peer_identity = peer_identity
        self.initiator = initiator
        self._send_key = self._recv_key = None
        self._send_seq = 0
        self._recv_seq = -1
        self._eph: kem.HybridKeyPair | None = None
        self._hello: bytes | None = None

    # --- handshake -------------------------------------------------------------------------
    def hello(self) -> bytes:
        assert self.initiator
        self._eph = kem.keygen()
        self._hello = self._eph.public_key
        return self._hello + self.identity.sign(b"hello|" + self._hello)

    def accept(self, hello: bytes) -> bytes:
        assert not self.initiator
        pk, sig = hello[:-SIG_LEN], hello[-SIG_LEN:]
        if not self.identity.verify(b"hello|" + pk, sig, self.peer_identity):
            raise ChannelError("initiator identity signature invalid (MITM?)")
        ss, ct = kem.encapsulate(pk)
        i2r, r2i = _keys(ss, pk + ct)
        self._send_key, self._recv_key = r2i, i2r
        return ct + self.identity.sign(b"reply|" + pk + ct)

    def finish(self, reply: bytes) -> None:
        assert self.initiator and self._eph is not None
        ct, sig = reply[:-SIG_LEN], reply[-SIG_LEN:]
        if not self.identity.verify(b"reply|" + self._hello + ct, sig, self.peer_identity):
            raise ChannelError("responder identity signature invalid (MITM?)")
        ss = kem.decapsulate(self._eph, ct)
        i2r, r2i = _keys(ss, self._hello + ct)
        self._send_key, self._recv_key = i2r, r2i
        self._eph = None

    # --- records ---------------------------------------------------------------------------
    def _aad(self, sending: bool, seq: int) -> bytes:
        direction = b"I2R" if (self.initiator == sending) else b"R2I"
        return direction + seq.to_bytes(8, "big")

    def seal(self, plaintext: bytes) -> bytes:
        if self._send_key is None:
            raise ChannelError("handshake not complete")
        seq = self._send_seq
        self._send_seq += 1
        nonce = b"\x00" * 4 + seq.to_bytes(8, "big")
        return seq.to_bytes(8, "big") + ChaCha20Poly1305(self._send_key).encrypt(
            nonce, plaintext, self._aad(True, seq))

    def open(self, record: bytes) -> bytes:
        if self._recv_key is None:
            raise ChannelError("handshake not complete")
        seq = int.from_bytes(record[:8], "big")
        if seq <= self._recv_seq:
            raise ChannelError(f"replayed or reordered record (seq {seq})")
        nonce = b"\x00" * 4 + seq.to_bytes(8, "big")
        try:
            pt = ChaCha20Poly1305(self._recv_key).decrypt(nonce, record[8:], self._aad(False, seq))
        except InvalidTag as e:
            raise ChannelError("record authentication failed (tampered or wrong key)") from e
        self._recv_seq = seq
        return pt


def connect(initiator_id: MLDSASigner, responder_id: MLDSASigner) -> tuple[SecureChannel, SecureChannel]:
    """In-process helper: run the full handshake between two local endpoints."""
    a = SecureChannel(initiator_id, responder_id.public_key, initiator=True)
    b = SecureChannel(responder_id, initiator_id.public_key, initiator=False)
    a.finish(b.accept(a.hello()))
    return a, b
