"""RFC 6962-style Merkle trees (the same construction as Certificate Transparency), with SHA3-256.

Leaves and inner nodes are domain-separated (0x00 / 0x01 prefix), so a leaf can never be
passed off as an inner node (second-preimage attack). An inclusion proof is O(log n) hashes:
anyone holding only the anchored root can check that a verdict is in the batch, without
downloading the ledger. That makes a "light client" auditor possible.
"""

from __future__ import annotations

import hashlib

EMPTY_ROOT = hashlib.sha3_256(b"").hexdigest()


def _leaf(data: bytes) -> bytes:
    return hashlib.sha3_256(b"\x00" + data).digest()


def _node(left: bytes, right: bytes) -> bytes:
    return hashlib.sha3_256(b"\x01" + left + right).digest()


def _split(n: int) -> int:
    """Largest power of two strictly less than n."""
    k = 1
    while k << 1 < n:
        k <<= 1
    return k


def _mth(leaves: list[bytes]) -> bytes:
    if len(leaves) == 1:
        return _leaf(leaves[0])
    k = _split(len(leaves))
    return _node(_mth(leaves[:k]), _mth(leaves[k:]))


def merkle_root(leaves: list[bytes]) -> str:
    return _mth(leaves).hex() if leaves else EMPTY_ROOT


def inclusion_proof(index: int, leaves: list[bytes]) -> list[tuple[str, str]]:
    """Audit path for leaves[index]: list of (side, sibling_hex); side 'L' = sibling on the left."""
    if not 0 <= index < len(leaves):
        raise IndexError(index)

    def path(m: int, d: list[bytes]) -> list[tuple[str, str]]:
        if len(d) == 1:
            return []
        k = _split(len(d))
        if m < k:
            return path(m, d[:k]) + [("R", _mth(d[k:]).hex())]
        return path(m - k, d[k:]) + [("L", _mth(d[:k]).hex())]

    return path(index, leaves)


def verify_inclusion(leaf: bytes, proof: list[tuple[str, str]] | list[list[str]], root: str) -> bool:
    h = _leaf(leaf)
    for side, sibling in proof:
        s = bytes.fromhex(sibling)
        h = _node(s, h) if side == "L" else _node(h, s)
    return h.hex() == root
