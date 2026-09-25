"""State used by D5 (freshness) and D6 (identity binding).

Freshness is tracked PER VERIFIER. The same signature may legitimately be verified by many
verifiers (transferability), but never twice by the same one. The registry can be rebuilt from
the ledger at startup (qsentinel/ledger/audit.py: rebuild_freshness), so replay protection
survives restarts.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class NonceRegistry:
    seen: set[tuple[str, str]] = field(default_factory=set)               # (verifier, nonce)
    last_counter: dict[tuple[str, str], int] = field(default_factory=dict)  # (signer, verifier)
    consumed_keys: set[tuple[str, str]] = field(default_factory=set)      # (verifier, key_id)

    def check(self, *, signer_id: str, verifier_id: str, nonce_hex: str, counter: int,
              key_id: str) -> list[str]:
        problems = []
        if (verifier_id, nonce_hex) in self.seen:
            problems.append("nonce already consumed at this verifier (replay)")
        if (verifier_id, key_id) in self.consumed_keys:
            problems.append("one-time key already consumed (key reuse / forgery attempt)")
        last = self.last_counter.get((signer_id, verifier_id), -1)
        if counter <= last:
            problems.append(f"counter {counter} not above last seen {last} (replay/reorder)")
        return problems

    def commit(self, *, signer_id: str, verifier_id: str, nonce_hex: str, counter: int,
               key_id: str) -> None:
        self.seen.add((verifier_id, nonce_hex))
        self.consumed_keys.add((verifier_id, key_id))
        k = (signer_id, verifier_id)
        self.last_counter[k] = max(counter, self.last_counter.get(k, -1))


@dataclass
class IdentityRegistry:
    key_owner: dict[str, str] = field(default_factory=dict)        # key_id -> signer_id
    authorised_verifiers: set[str] = field(default_factory=set)    # RBAC: may verify
    honeypots: set[str] = field(default_factory=set)               # decoy key_ids, never signed

    def bind_key(self, key_id: str, signer_id: str) -> None:
        self.key_owner[key_id] = signer_id
