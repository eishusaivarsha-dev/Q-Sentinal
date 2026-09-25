# chain/: permissioned blockchain (Phase 3, D10). Owner: Blockchain Lead

The hackathon build uses the Python hash-chain ledger in `qsentinel/ledger/`. That ledger is already quantum-safe, because every entry is signed with ML-DSA-65. This folder holds the Phase 3 upgrade.

## Plan
1. **Network:** 4-node Hyperledger Fabric 2.5 test network (Docker Compose), or Besu with IBFT 2.0.
2. **Chaincode (Go), in `chaincode/`:**
   - `AnchorVerdict(transcriptHash, decision, keyId, verifierId, nonce)`
   - `ConsumeNonce(nonce)`, which fails if the nonce has already been used (network-wide replay guard)
   - `CommitMeasurement` / `RevealMeasurement`, for commit-reveal symmetrisation between verifiers (transferability, see docs/protocol.md §6)
3. **Off-chain:** full transcripts go to IPFS or Fabric private data. Only SHA3-256 hashes go on-chain.
4. **Post-quantum signing:** Fabric's MSP signs with ECDSA. Until a custom ML-DSA MSP exists, every payload also carries an **ML-DSA-65 signature** (from `qsentinel.pqc`) that the chaincode checks. Say this clearly in the pitch.
5. **Client:** `qsentinel/ledger/fabric.py`, implementing the same interface as `HashChainLedger`.
