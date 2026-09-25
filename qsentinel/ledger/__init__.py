"""L3 - Non-repudiation ledger. OWNER: Blockchain Lead.

Hackathon: hash-chained, ML-DSA-signed append-only log (quantum-safe end to end), with
Merkle anchoring, commit-reveal symmetrisation records and an external auditor.
Phase 3: Hyperledger Fabric/Besu network in chain/, with this module as the client SDK.
"""

from .audit import audit, find_disputes, rebuild_freshness
from .hashchain import HashChainLedger, LedgerEntry

__all__ = ["HashChainLedger", "LedgerEntry", "audit", "find_disputes", "rebuild_freshness"]
