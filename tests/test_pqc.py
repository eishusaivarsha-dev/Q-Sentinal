import itertools

import pytest

from qsentinel.pqc import ChannelError, MLDSASigner, SecureChannel, connect, kem
from qsentinel.pqc.signer import IMPLS, _available

AVAILABLE = [i for i in IMPLS if _available(i)]


@pytest.mark.parametrize("signer_impl,verifier_impl", list(itertools.product(AVAILABLE, AVAILABLE)))
def test_mldsa_implementations_interoperate(signer_impl, verifier_impl):
    """Every FIPS 204 implementation must verify every other's signatures (and reject tampering)."""
    s = MLDSASigner(implementation=signer_impl)
    v = MLDSASigner(public_key=s.public_key, implementation=verifier_impl)
    sig = s.sign(b"ledger entry")
    assert v.verify(b"ledger entry", sig)
    assert not v.verify(b"ledger entrY", sig)


def test_fast_native_implementation_is_preferred_when_present():
    if "openssl" in AVAILABLE:
        assert MLDSASigner().implementation == "openssl"


@pytest.fixture(scope="module")
def ids():
    return MLDSASigner(), MLDSASigner(), MLDSASigner()


def test_hybrid_kem_agrees():
    kp = kem.keygen()
    ss, ct = kem.encapsulate(kp.public_key)
    assert ss == kem.decapsulate(kp, ct) and len(ss) == 32


def test_channel_roundtrip_both_directions(ids):
    a, b = connect(ids[0], ids[1])
    assert b.open(a.seal(b"m0m1=10")) == b"m0m1=10"
    assert a.open(b.seal(b"ack")) == b"ack"


def test_channel_rejects_tamper_replay_and_reflection(ids):
    a, b = connect(ids[0], ids[1])
    rec = a.seal(b"verdict")
    bad = bytearray(rec)
    bad[-1] ^= 1
    with pytest.raises(ChannelError):
        b.open(bytes(bad))
    b.open(rec)
    with pytest.raises(ChannelError):
        b.open(rec)                     # replay
    with pytest.raises(ChannelError):
        a.open(a.seal(b"x"))            # reflection back to sender


def test_mitm_with_wrong_identity_fails(ids):
    alice, bob, mallory = ids
    a = SecureChannel(alice, bob.public_key, initiator=True)
    fake_bob = SecureChannel(mallory, alice.public_key, initiator=False)
    with pytest.raises(ChannelError):
        a.finish(fake_bob.accept(a.hello()))   # alice pinned bob's key; mallory can't sign as bob
