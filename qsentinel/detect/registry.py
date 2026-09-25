"""State used by D5 (freshness) and D6 (identity binding).

TODO(blockchain-lead): back NonceRegistry with the ledger so a nonce is consumed exactly once
network-wide (rebuild from ledger on startup).
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class NonceRegistry:
    seen: set[str] = field(default_factory=set)
    last_counter: dict[str, int] = field(default_factory=dict)

    def check(self, signer_id: str, nonce_hex: str, counter: int) -> list[str]:
        problems = []
        if nonce_hex in self.seen:
            problems.append("nonce already consumed (replay)")
        if counter <= self.last_counter.get(signer_id, -1):
            problems.append(f"counter {counter} not above last seen "
                            f"{self.last_counter[signer_id]} (replay/reorder)")
        return problems

    def commit(self, signer_id: str, nonce_hex: str, counter: int) -> None:
        self.seen.add(nonce_hex)
        self.last_counter[signer_id] = max(counter, self.last_counter.get(signer_id, -1))


@dataclass
class IdentityRegistry:
    key_owner: dict[str, str] = field(default_factory=dict)        # key_id -> signer_id
    authorised_verifiers: set[str] = field(default_factory=set)    # RBAC: may verify

    def bind_key(self, key_id: str, signer_id: str) -> None:
        self.key_owner[key_id] = signer_id
