import pytest

from qsentinel.pqc import ChannelError, MLDSASigner, SecureChannel, connect, kem


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
