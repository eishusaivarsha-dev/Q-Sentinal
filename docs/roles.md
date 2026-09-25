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
- [ ] Port `bell_correlators` to `QiskitAerBackend`.
- [ ] Add amplitude-damping noise through QuTiP or Aer density-matrix (the `.[noise]` extra).
- [ ] With Security: an `entangle_and_measure` channel model in the Stim backend.
- [ ] Early: run **one real IBM teleportation job** and save the result for the pitch. Batch it; the Open plan gives about 10 min/month.

## Detection Lead
- [ ] **Per-basis QBER fingerprint** in D4: a likelihood-ratio test that tells "Eve measures in Z only" apart from depolarising noise. This is attack attribution without ML.
- [ ] Channel-level rolling window for D3 (CHSH) and CUSUM across verifications.
- [ ] `notebooks/01_calibration.ipynb`: empirical forgery/FRR rates over 10⁵ trials against the Chernoff bounds (the D5 deliverable: within ±10%).
- [ ] SPRT early stop: report how many quantum rounds are saved per rejection.

## Security Lead
- [ ] Implement the `entangle_and_measure` attack (collective attack).
- [ ] Strength sweep: detection rate vs adversary strength, 0–100%, for each attack (for the D7 report).
- [ ] Add OAuth 2.1 / API keys and RBAC to the FastAPI routes.
- [ ] ML-KEM-768 key exchange helper in `qsentinel/pqc/`.
- [ ] Add semgrep to CI.

## Blockchain Lead
- [ ] Merkle-batch anchoring (one root per N verdicts).
- [ ] Rebuild the `NonceRegistry` from the ledger at startup (a nonce is consumed once, network-wide).
- [ ] **Commit-reveal symmetrisation** between verifiers, then the `repudiation` attack plus its detector (transferability).
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
