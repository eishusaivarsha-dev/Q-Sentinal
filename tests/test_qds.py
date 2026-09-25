import pytest

from qsentinel.config import FAST
from qsentinel.qds import KeyAlreadyUsedError, distribute, keygen, sign, verify
from qsentinel.quantum import get_backend


def test_honest_signature_has_zero_mismatches():
    priv = keygen("alice", FAST.protocol, seed=1)
    pub = distribute(priv, "bob")
    sig = sign(priv, b"hello", counter=0)
    t = verify(sig, pub, get_backend(), seed=2)
    assert t.block_mismatches.sum() == 0
    assert t.total_rounds == FAST.protocol.hash_bits * FAST.protocol.rounds_per_bit


def test_frr_zero_over_many_signatures():
    """D3 acceptance criterion (scaled down): honest signatures always verify exactly."""
    be = get_backend()
    for i in range(200):
        priv = keygen("alice", FAST.protocol, seed=i)
        t = verify(sign(priv, f"m{i}".encode(), i), distribute(priv, "bob"), be, seed=i)
        assert t.block_mismatches.sum() == 0


def test_keys_are_one_time():
    priv = keygen("alice", FAST.protocol, seed=1)
    sign(priv, b"a", 0)
    with pytest.raises(KeyAlreadyUsedError):
        sign(priv, b"b", 1)


def test_signature_json_roundtrip():
    priv = keygen("alice", FAST.protocol, seed=1)
    sig = sign(priv, b"hello", 0)
    from qsentinel.qds import Signature
    again = Signature.from_dict(sig.to_dict())
    assert again.nonce == sig.nonce and (again.revealed_bases == sig.revealed_bases).all()
