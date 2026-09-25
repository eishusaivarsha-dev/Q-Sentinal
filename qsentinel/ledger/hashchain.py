"""Append-only hash chain: entry_hash = SHA3-256(index, prev_hash, payload_hash, timestamp),
each entry signed with ML-DSA-65. Only hashes/commitments go on-chain; full transcripts stay
off-chain (IPFS / Fabric private data in Phase 3).

Merkle anchoring: every `merkle_batch` verdicts, a "merkle_anchor" entry commits the Merkle
root of their entry hashes. In Phase 3 only these roots need to go to Fabric (or a public
chain), which is cheap. Every verdict stays provable through an O(log n) inclusion proof.

Entry kinds written by the pipeline:
  verdict, merkle_anchor, link_commissioned, sym_commit, sym_reveal
"""

from __future__ import annotations

import hashlib
import json
import threading
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from ..pqc.signer import MLDSASigner
from .merkle import inclusion_proof, merkle_root, verify_inclusion

GENESIS = "0" * 64


def _h(obj) -> str:
    return hashlib.sha3_256(json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


@dataclass
class LedgerEntry:
    index: int
    timestamp: float
    kind: str
    prev_hash: str
    payload_hash: str
    payload: dict
    entry_hash: str
    signature: str   # hex ML-DSA-65 over entry_hash


class HashChainLedger:
    def __init__(self, signer: MLDSASigner | None = None, path: str | Path | None = None):
        self.signer = signer or MLDSASigner()
        self.path = Path(path) if path else None
        self.entries: list[LedgerEntry] = []
        self.listeners: list = []          # callables(entry), e.g. the pipeline's telemetry hook
        self._lock = threading.RLock()
        if self.path and self.path.exists():
            self.entries = [LedgerEntry(**json.loads(line))
                            for line in self.path.read_text().splitlines() if line]

    # --- writing ---------------------------------------------------------------------------
    def append(self, kind: str, payload: dict) -> LedgerEntry:
        with self._lock:
            prev = self.entries[-1].entry_hash if self.entries else GENESIS
            index, ts, ph = len(self.entries), time.time(), _h(payload)
            eh = _h({"index": index, "prev": prev, "payload_hash": ph, "ts": ts, "kind": kind})
            entry = LedgerEntry(index, ts, kind, prev, ph, payload, eh,
                                self.signer.sign(bytes.fromhex(eh)).hex())
            self.entries.append(entry)
            if self.path:
                with self.path.open("a") as f:
                    f.write(json.dumps(asdict(entry)) + "\n")
        for listener in self.listeners:
            listener(entry)
        return entry

    def unanchored_verdicts(self) -> list[int]:
        last = max((e.payload["last"] for e in self.entries if e.kind == "merkle_anchor"), default=-1)
        return [e.index for e in self.entries if e.kind == "verdict" and e.index > last]

    def anchor(self, batch: int | None = None, force: bool = False) -> LedgerEntry | None:
        """Append a Merkle anchor over pending verdicts if at least `batch` are waiting."""
        with self._lock:
            pending = self.unanchored_verdicts()
            if not pending or (not force and batch is not None and len(pending) < batch):
                return None
            leaves = [bytes.fromhex(self.entries[i].entry_hash) for i in pending]
            return self.append("merkle_anchor", {"root": merkle_root(leaves), "first": pending[0],
                                                 "last": pending[-1], "members": pending})

    # --- proofs ----------------------------------------------------------------------------
    def inclusion_proof(self, index: int) -> dict | None:
        """Proof that verdict `index` is under an anchored Merkle root, or None if still pending."""
        for a in self.entries:
            if a.kind == "merkle_anchor" and index in a.payload["members"]:
                members = a.payload["members"]
                leaves = [bytes.fromhex(self.entries[i].entry_hash) for i in members]
                return {"index": index, "leaf": self.entries[index].entry_hash,
                        "root": a.payload["root"], "anchor_index": a.index,
                        "proof": inclusion_proof(members.index(index), leaves)}
        return None

    @staticmethod
    def check_proof(proof: dict) -> bool:
        return verify_inclusion(bytes.fromhex(proof["leaf"]), proof["proof"], proof["root"])

    # --- verification ----------------------------------------------------------------------
    def verify_chain(self) -> tuple[bool, str]:
        prev = GENESIS
        for e in self.entries:
            if e.prev_hash != prev:
                return False, f"entry {e.index}: broken link"
            if _h(e.payload) != e.payload_hash:
                return False, f"entry {e.index}: payload tampered"
            eh = _h({"index": e.index, "prev": e.prev_hash, "payload_hash": e.payload_hash,
                     "ts": e.timestamp, "kind": e.kind})
            if eh != e.entry_hash:
                return False, f"entry {e.index}: header tampered"
            if not self.signer.verify(bytes.fromhex(eh), bytes.fromhex(e.signature)):
                return False, f"entry {e.index}: bad ML-DSA signature"
            prev = e.entry_hash
        return True, f"{len(self.entries)} entries verified"

    def by_kind(self, kind: str) -> list[LedgerEntry]:
        return [e for e in self.entries if e.kind == kind]
