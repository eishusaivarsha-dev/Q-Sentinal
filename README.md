# Q-SENTINEL

**Quantum Signature Entanglement-based Threat Intelligence & Non-repudiable Event Ledger**
*An AI-free threat detection framework for teleportation-based Quantum Digital Signatures, with information-theoretic security.* Smart India Hackathon 2026.

> Quantum physics decides accept/reject. Every verdict is a closed-form statistical rule with a proven error bound, and **no AI/ML is in the trust path** (CI enforces this).
> An advisory AI watches for fraud, explains what it sees and suggests what to do, **but the analyst makes the final call**, and that decision is signed onto the ledger next to the AI's advice.

**Live demo:** https://q-sentinel-5g81.onrender.com (free tier: the first visit after idle takes ~1 min to wake) · run it yourself in one command: `docker build -t q-sentinel . && docker run -p 7860:7860 q-sentinel` → http://localhost:7860

## Quick start

Three processes, three terminals (or `docker compose up --build` for all of them plus Redis):

```bash
# 1. Backend API (Python 3.11+)
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn qsentinel.api.main:app --reload                  # -> http://localhost:8000/docs

# 2. Advisory AI service (optional; powers the dashboard's Ops page)
pip install -e ops
uvicorn qsentinel_ops.server:app --port 8100             # -> http://localhost:8100/incidents

# 3. Dashboard (Node 20+)
cd web && npm install && npm run dev                     # -> http://localhost:5173
```

Checks: `pytest` (all tests) · `python -m qsentinel.attacks.run` (17-scenario red-team campaign) · `ruff check .` · `lint-imports` (no AI in the trust path).
Set `QSENTINEL_PROFILE=full` for full-size protocol parameters (L=256, n=256), and `QSENTINEL_API_KEYS` to switch on role-based access (see `qsentinel/api/main.py`).

Optional extras: `pip install -e ".[qiskit]"` (Aer cross-check), `.[noise]` (QuTiP), `.[ibm]` (hardware), `.[pqc]` (liboqs), `.[redis]` (Redis Streams telemetry mirror).

## Repository map and owners

| Path | Layer | What lives here | Owner |
|---|---|---|---|
| `qsentinel/quantum/` | L0 | Stim (default), Qiskit Aer and IBM backends behind one interface | Quantum Lead |
| `qsentinel/qds/` | L1 | KeyGen, teleportation distribution, Sign, Verify (one-time keys, Lamport binding) | Quantum Lead |
| `qsentinel/detect/` | L2 | **Trust kernel:** D1–D6, Chernoff calibration, SPRT/CUSUM, proof certificates | Detection Lead |
| `qsentinel/pqc/` | L3 | ML-DSA-65 and hybrid ML-KEM-768 (native OpenSSL, liboqs or pure-Python fallback), secure tunnel | Security Lead |
| `qsentinel/ledger/` | L3 | Hash-chained, ML-DSA-signed ledger | Blockchain Lead |
| `chain/` | L3 | Hyperledger Fabric/Besu network + chaincode (Phase 3) | Blockchain Lead |
| `qsentinel/attacks/` | L4 | Attack library + YAML campaigns | Security Lead |
| `qsentinel/api/` | - | FastAPI REST + WebSocket | Team Lead |
| `web/` | L5 | Landing page + Trust Console: 13 pages with 3-D scenes, live WebSocket feed, Fraud Review, Presenter Mode (React, React Three Fiber, Recharts, Framer Motion) | Frontend Lead |
| `ops/` | L5 | AI operations plane, **advisory only**, separate package: incidents, forecasts, anomalies, fraud queue, Sentinel Copilot (Claude or offline) | Team Lead |
| `Q-SENTINEL_D1-D6/` | - | Stand-alone D1-D6 reference implementation, as delivered; its criteria also run on the integrated system (`python -m qsentinel.acceptance`) | Anansh Jain |
| `tests/` | - | Unit, integration, and the `test_no_ml_in_trust_path` guard | everyone |
| `docs/` | - | Architecture, protocol, roles, roadmap | everyone |

**New to the team? Read [CONTRIBUTING.md](CONTRIBUTING.md), then [docs/FILE_GUIDE.md](docs/FILE_GUIDE.md) (what every file does) and [docs/roles.md](docs/roles.md) (your tasks).**

## Current status (verified)

- The honest signature always verifies: 0 mismatches across 65,536 rounds, with CHSH S = 2.828.
- Intercept-resend gives QBER ≈ 0.333 (six-state) / 0.25 (two-basis), and CHSH falls below 2.
- Full-size sign + verify (L=256, n=256, 65k rounds, ledger write included) takes ~9 ms: about 116 per second, above the dossier's 100/s target (NFR-6). Native OpenSSL ML-DSA made ledger signing ~200x faster.
- The attack campaign passes 17/17: forgeries, intercept-resend, entangle-and-measure, stealth probes, replay, key reuse, MITM, repudiation, impersonation, unauthorised verification, and stolen keystore (via a honeypot).
- The Pauli fingerprint catches a 3% single-basis probe at QBER 1% (far below the 11% threshold), and estimates its size as 3.1%.
- With symmetrisation, transferability holds in 100% of trials at every tampering level. Without it, the ledger audit flags every split.
- The forgery bound, validated through the simulator, is within 0.9% of the exact formula.
- The Qiskit Aer backend now supplies D3's Bell correlators, and a direct CHSH test with rotated (non-Clifford) settings matches the stabilizer-derived S on six channel models (`python -m qsentinel.quantum.chsh_direct`).
- The dashboard is wired to every backend feature: live alerts, proof certificates with in-browser Merkle verification, the 3-D channel ellipsoid, attacks, sweeps, the ledger auditor, the advisory AI's incidents, and a 7-step Presenter Mode. The 17-scenario campaign also passes 17/17 when run from the browser.
- **Fraud review (human in the loop):** the advisory AI scores every verification for fraud (0-100, with reasons that trace to detectors or the ledger) and recommends confirm / escalate / monitor / dismiss. The analyst decides in the Fraud Review page; `POST /reviews/{i}` chains that decision on the ML-DSA ledger with the AI's suggestion and whether they agreed. The verdict itself is never changed.
- **Sentinel Copilot** answers questions about verdicts, links, forecasts and the fraud queue, citing ledger entries. With `ANTHROPIC_API_KEY` set it uses Claude (`claude-opus-5` by default, server-side refusal fallback on); without it an offline analyst answers from the same read-only brief.
- **3-D front end:** landing page with a 3-D entangled-core hero and a scroll-driven 3-D protocol story; live 3-D quantum network, Bloch-sphere teleportation lab, 3-D channel ellipsoid, 3-D ledger chain and a fraud "risk orb" in the console.
- The D1-D6 acceptance criteria run against this build from the dashboard's Report page (`GET /report/acceptance`).
- Not yet implemented: measure-on-receipt mode, Fabric, and IBM hardware. See [docs/roles.md](docs/roles.md).

## Deploy

The root `Dockerfile` builds one public image: nginx serves the dashboard on `$PORT` and proxies `/api` to the trust kernel and `/ops` to the advisory AI, each in its own virtual environment (the kernel's has no ML library; the build fails if one sneaks in).

- **Render (free):** New → Blueprint → this repository. `render.yaml` configures everything; optionally add `ANTHROPIC_API_KEY` in the dashboard.
- **Hugging Face Spaces / Koyeb / Railway / Fly:** any host that runs a Dockerfile and sets `$PORT`.
- **Local:** `docker build -t q-sentinel . && docker run -p 7860:7860 q-sentinel`, or `docker compose up --build` for separate containers plus Redis.

## Docs
- [docs/FILE_GUIDE.md](docs/FILE_GUIDE.md): what every file in the repository does
- [docs/architecture.md](docs/architecture.md): the six layers and the one-way telemetry rule
- [docs/protocol.md](docs/protocol.md): the protocol, the security bounds and the n-vs-noise trade-off
- [docs/detection-security-blockchain.md](docs/detection-security-blockchain.md): detectors, attacks, post-quantum channel and ledger, with how to run each
- [docs/code-walkthrough.md](docs/code-walkthrough.md): file-by-file, function-by-function explanation of the detection, cybersecurity and blockchain code
- [docs/frontend-spec.md](docs/frontend-spec.md): the Trust Console (dashboard) specification, now implemented in `web/`
- [docs/roadmap.md](docs/roadmap.md): phases P0–P5 and which tools come in when

## Contributors
See [CONTRIBUTORS.md](CONTRIBUTORS.md).
