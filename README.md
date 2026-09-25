# Q-SENTINEL

**Quantum Signature Entanglement-based Threat Intelligence & Non-repudiable Event Ledger**
*An AI-free threat detection framework for teleportation-based Quantum Digital Signatures, with information-theoretic security.* Smart India Hackathon 2026.

> Quantum physics decides accept/reject. Every verdict is a closed-form statistical rule with a proven error bound, and **no AI/ML is in the trust path** (CI enforces this).

## Quick start

```bash
# 1. Python core (3.11+)
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

pytest                                                   # all tests
python -m qsentinel.attacks.run                          # red-team campaign: every attack must be caught
uvicorn qsentinel.api.main:app --reload                  # API -> http://localhost:8000/docs

# 2. SOC dashboard (Node 20+), in a second terminal
cd web && npm install && npm run dev                     # -> http://localhost:5173

# Or everything at once
docker compose up --build
```

Optional extras: `pip install -e ".[qiskit]"` (Aer cross-check), `.[noise]` (QuTiP), `.[ibm]` (hardware), `.[pqc]` (liboqs).

## Repository map and owners

| Path | Layer | What lives here | Owner |
|---|---|---|---|
| `qsentinel/quantum/` | L0 | Stim (default), Qiskit Aer and IBM backends behind one interface | Quantum Lead |
| `qsentinel/qds/` | L1 | KeyGen, teleportation distribution, Sign, Verify (one-time keys, Lamport binding) | Quantum Lead |
| `qsentinel/detect/` | L2 | **Trust kernel:** D1–D6, Chernoff calibration, SPRT/CUSUM, proof certificates | Detection Lead |
| `qsentinel/pqc/` | L3 | ML-DSA-65 (liboqs, or dilithium-py as fallback) | Security Lead |
| `qsentinel/ledger/` | L3 | Hash-chained, ML-DSA-signed ledger | Blockchain Lead |
| `chain/` | L3 | Hyperledger Fabric/Besu network + chaincode (Phase 3) | Blockchain Lead |
| `qsentinel/attacks/` | L4 | Attack library + YAML campaigns | Security Lead |
| `qsentinel/api/` | - | FastAPI REST + WebSocket | Team Lead |
| `web/` | L5 | React SOC dashboard (Recharts, Three.js) | Frontend Lead |
| `ops/` | L5 | AI operations plane, **advisory only**, separate package | Team Lead |
| `tests/` | - | Unit, integration, and the `test_no_ml_in_trust_path` guard | everyone |
| `docs/` | - | Architecture, protocol, roles, roadmap | everyone |

**New to the team? Read [CONTRIBUTING.md](CONTRIBUTING.md), then [docs/roles.md](docs/roles.md) for your first tasks.**

## Current status (verified)

- The honest signature always verifies: 0 mismatches across 65,536 rounds, with CHSH S = 2.828.
- Intercept-resend gives QBER ≈ 0.333 (six-state) / 0.25 (two-basis), and CHSH falls below 2.
- Full-size verification (L=256, n=256, 65k rounds) takes about 30 ms on the Stim backend.
- The attack campaign passes 17/17: forgeries, intercept-resend, entangle-and-measure, stealth probes, replay, key reuse, MITM, repudiation, impersonation, unauthorised verification, and stolen keystore (via a honeypot).
- The Pauli fingerprint catches a 3% single-basis probe at QBER 1% (far below the 11% threshold), and estimates its size as 3.1%.
- With symmetrisation, transferability holds in 100% of trials at every tampering level. Without it, the ledger audit flags every split.
- The forgery bound, validated through the simulator, is within 0.9% of the exact formula.
- Not yet implemented: measure-on-receipt mode, Fabric, and IBM hardware. See [docs/roles.md](docs/roles.md).

## Docs
- [docs/architecture.md](docs/architecture.md): the six layers and the one-way telemetry rule
- [docs/protocol.md](docs/protocol.md): the protocol, the security bounds and the n-vs-noise trade-off
- [docs/detection-security-blockchain.md](docs/detection-security-blockchain.md): detectors, attacks, post-quantum channel and ledger, with how to run each
- [docs/code-walkthrough.md](docs/code-walkthrough.md): file-by-file, function-by-function explanation of the detection, cybersecurity and blockchain code
- [docs/frontend-spec.md](docs/frontend-spec.md): the Trust Console (dashboard) specification
- [docs/roadmap.md](docs/roadmap.md): phases P0–P5 and which tools come in when
