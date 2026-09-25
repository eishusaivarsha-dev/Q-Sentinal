"""Append-only hash chain: entry_hash = SHA3-256(index, prev_hash, payload_hash, timestamp),
each entry signed with ML-DSA-65. Only hashes/commitments go on-chain; full transcripts stay
off-chain (IPFS / Fabric private data in Phase 3).

TODO(blockchain-lead):
  * Merkle-batch anchoring (one root per N verdicts)
  * commit-reveal symmetrisation between verifiers (transferability, docs/protocol.md s.6)
  * rebuild NonceRegistry from ledger on startup
"""

from __future__ import annotations

import hashlib
import json
import threading
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from ..pqc.signer import MLDSASigner

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
        self._lock = threading.Lock()
        if self.path and self.path.exists():
            self.entries = [LedgerEntry(**json.loads(line))
                            for line in self.path.read_text().splitlines() if line]

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
            return entry

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
