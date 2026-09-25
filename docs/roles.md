# Team roles and first tasks

Six roles (SIH team size). Each person owns folders, reviews PRs there, and starts with the tasks below. Put names in the table, and GitHub usernames in `.github/CODEOWNERS`.

| Role | Name | Owns | Main tools |
|---|---|---|---|
| Team Lead / Integration | | `qsentinel/api/`, `ops/`, `.github/`, `deploy/`, pitch | FastAPI, Docker, GitHub Actions |
| Quantum Lead | | `qsentinel/quantum/`, `qsentinel/qds/` | Stim, Qiskit, QuTiP, IBM Quantum |
| Detection Lead | | `qsentinel/detect/` | NumPy, SciPy, statistics |
| Security Lead | | `qsentinel/attacks/`, `qsentinel/pqc/` | liboqs, bandit/semgrep, Hypothesis |
| Blockchain Lead | | `qsentinel/ledger/`, `chain/` | hash chains, Hyperledger Fabric/Besu, Go |
| Frontend Lead | | `web/` | React, TypeScript, Tailwind, Recharts, Three.js |

---

## Quantum Lead
- [ ] **Measure-on-receipt mode** (no quantum memory): the verifier measures on arrival in a random basis and later checks only the positions where the bases match. See `qds/keys.py`.
- [x] Port `bell_correlators` to `QiskitAerBackend` (Shubham Kumar).
- [ ] Add amplitude-damping noise through QuTiP or Aer density-matrix (the `.[noise]` extra).
- [x] With Security: an `entangle_and_measure` channel model in the Stim backend.
- [ ] Early: run **one real IBM teleportation job** and save the result for the pitch. Batch it; the Open plan gives about 10 min/month.

## Detection Lead
- [x] **Per-basis QBER fingerprint** in D4 (`detect/fingerprint.py`): Pauli-channel tomography plus a G-test against the frozen baseline, with attack attribution and no ML.
- [x] Channel-level rolling window for D3 (CHSH) and CUSUM across verifications (`detect/channel_monitor.py`).
- [x] Exact binomial bounds next to Chernoff, plus a simulator Monte-Carlo check (`detect/validate.py`; 0.9% error, D5 needs ≤ 10%).
- [x] SPRT early stop: `rounds_saved_by_sprt` in the D4 output.
- [x] Honeypot keys in D6.
- [ ] `notebooks/01_calibration.ipynb`: plots from `detect/validate.py` for the report.

## Security Lead
- [x] `entangle_and_measure` attack, plus the information-vs-disturbance meter.
- [x] New attacks: `stealth_probe`, `key_reuse_forgery`, `stolen_key_honeypot`, `repudiation(_unprotected)`.
- [x] Strength sweep CLI: `python -m qsentinel.attacks.sweep <attack>` (CSV for the D7 report).
- [x] API-key RBAC on the FastAPI routes (identity comes from the key, not the request body).
- [x] Hybrid X25519 + ML-KEM-768 KEM and an ML-DSA-authenticated AEAD channel (`pqc/kem.py`, `pqc/channel.py`).
- [x] semgrep in CI (advisory).
- [ ] Carry the teleportation correction bits over `SecureChannel` in the node-to-node transport.
- [ ] OAuth 2.1 / mTLS in front of the API; API keys in Vault.

## Blockchain Lead
- [x] Merkle-batch anchoring with RFC 6962-style inclusion proofs (`ledger/merkle.py`).
- [x] Rebuild the `NonceRegistry` from the ledger at startup (`ledger/audit.py`).
- [x] **Commit-reveal symmetrisation** (`ledger/commit_reveal.py`, `qds/symmetrise.py`), the `repudiation` attack, and the ledger dispute auditor.
- [ ] Phase 3: a 4-node Fabric network in `chain/` with Go chaincode (see `chain/README.md`).

## Frontend Lead
- [ ] Ledger page (`GET /ledger`, `GET /ledger/verify`) showing the chain-valid badge.
- [ ] Download the proof certificate as JSON/PDF from `VerdictCard`, with a QR code.
- [ ] Trade-off chart from `GET /calibration`: n vs noise tolerance.
- [ ] Live Bloch-sphere animation of the round being verified.
- [ ] Mobile layout pass.

## Team Lead
- [ ] Fill in names above and uncomment `.github/CODEOWNERS`.
- [ ] Protect `main`: require PRs and CI. (On a free personal account, branch protection or rulesets need a **public** repo or GitHub Pro/Team.)
- [ ] Redis Streams telemetry bus with a read-only ACL for `ops/`.
- [ ] Demo script (under 6 min): honest → forgery → intercept slider → replay → ledger check.
- [ ] A pre-recorded backup video of the demo.
