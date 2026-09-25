"""Commit-reveal for symmetrisation seeds (and anything else parties must fix in advance).

Each verifier j picks a secret share s_j and posts  c_j = SHA3-256(tag | key_id | party | salt | s_j)
on the ledger BEFORE any signature exists. The joint seed is SHA3 over all shares (in party
order), so:
  * no single verifier can steer the shuffle (it needs everyone's share),
  * nobody can change a share after seeing the others (the commitment binds it),
  * the signer never sees the shares in time to tailor her equivocation,
  * later, an arbiter checks each reveal against its on-chain commitment and recomputes the
    exact shuffle, so it can prove who held which quantum states.
"""

from __future__ import annotations

import hashlib
import hmac

TAG = b"QSENTINEL-SYM-v1"


def commitment(key_id: str, party: str, share: bytes, salt: bytes) -> str:
    return hashlib.sha3_256(b"|".join([TAG, key_id.encode(), party.encode(), salt, share])).hexdigest()


def verify_reveal(key_id: str, party: str, share: bytes, salt: bytes, commit_hex: str) -> bool:
    return hmac.compare_digest(commitment(key_id, party, share, salt), commit_hex)


def joint_seed(key_id: str, shares: dict[str, bytes]) -> int:
    h = hashlib.sha3_256(TAG + b"|seed|" + key_id.encode())
    for party in sorted(shares):
        h.update(party.encode() + b"=" + shares[party])
    return int.from_bytes(h.digest()[:8], "big")
