import numpy as np

from qsentinel.qds.keygen import generate_keypair, distribute_public_key
from qsentinel.qds.signer import sign
from qsentinel.qds.verifier import verify
from qsentinel.quantum.backends import IdealBackend


def make_protocol(rounds=128):
    private, verifier = generate_keypair(rounds=rounds, seed=1234)
    public = distribute_public_key(private, backend=IdealBackend())
    return private, verifier, public


def test_honest_signature_accepts():
    private, verifier, public = make_protocol(64)
    signature = sign("hello", private, public, nonce="nonce-1")
    result = verify("hello", signature, public, verifier, rng=np.random.default_rng(9))
    assert result.accepted
    assert result.mismatches == 0


def test_wrong_message_rejects():
    private, verifier, public = make_protocol(32)
    signature = sign("hello", private, public, nonce="nonce-1")
    result = verify("tampered", signature, public, verifier, rng=np.random.default_rng(9))
    assert not result.accepted
    assert not result.message_binding_ok


def test_replay_flag_rejects():
    private, verifier, public = make_protocol(16)
    signature = sign("hello", private, public, nonce="nonce-1")
    result = verify("hello", signature, public, verifier, nonce_already_used=True, rng=np.random.default_rng(9))
    assert not result.accepted
