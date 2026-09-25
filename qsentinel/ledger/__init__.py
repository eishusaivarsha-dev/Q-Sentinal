"""L3 - Non-repudiation ledger. OWNER: Blockchain Lead.

Hackathon: hash-chained, ML-DSA-signed append-only log (quantum-safe end to end).
Phase 3: Hyperledger Fabric/Besu network in chain/, with this module as the client SDK.
"""

from .hashchain import HashChainLedger, LedgerEntry

__all__ = ["HashChainLedger", "LedgerEntry"]
