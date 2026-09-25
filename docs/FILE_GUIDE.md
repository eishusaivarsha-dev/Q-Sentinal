# File guide: what every file does

Every file in the repository, grouped by folder, in plain language. For *how* the code works line by line, see [code-walkthrough.md](code-walkthrough.md). For the big picture, see [architecture.md](architecture.md).

## How the pieces connect

```
 Browser: web/  (React dashboard, "Trust Console")
    │  REST + WebSocket (/ws/telemetry)                       │ REST (/incidents)
    ▼                                                         ▼
 qsentinel/api/main.py  (FastAPI, port 8000)          ops/qsentinel_ops/server.py (port 8100)
    │                                                         ▲   advisory AI: reads telemetry only,
    ▼                                                         │   never writes anything back
 qsentinel/pipeline.py  ── sign → teleport → verify → detect → ledger → telemetry ──┘
    │            │                 │                 │
    ▼            ▼                 ▼                 ▼
 quantum/     qds/              detect/           ledger/ + pqc/
 (L0 sim)     (L1 protocol)     (L2 D1–D6)        (L3 blockchain + crypto)
                                   ▲
 attacks/  (L4 practice hacker) ───┘ drives the pipeline with hostile inputs
```

The decision is made in `detect/` and nowhere else. Everything above it only reads.

## Where do I look when…

| I want to… | Open |
|---|---|
| change a threshold (τ, QBER limit, CUSUM…) | `qsentinel/config.py` |
| change what an alarm checks | `qsentinel/detect/d1_…` to `d6_…` |
| add an attack | `qsentinel/attacks/library.py` (+ `campaigns/smoke.yaml`) |
| add an API endpoint | `qsentinel/api/main.py` (+ `web/src/api/client.ts` + `types.ts`) |
| change a dashboard page | `web/src/pages/<Page>.tsx` |
| change how alerts are named ("Probe in Z basis"…) | `web/src/lib/attribution.ts` |
| change what gets written to the blockchain | `qsentinel/pipeline.py` → `ledger.append(...)` |
| run everything | README → "Quick start", or `docker compose up --build` |

---

## Root

| File | What it does |
|---|---|
| `README.md` | Front page: what the project is, how to run it, current verified status, links to docs |
| `CONTRIBUTING.md` | Team workflow: branch → PR → review → merge; house rules (no AI in the trust path, no secrets) |
| `CONTRIBUTORS.md` | Who contributed what (add yourself after your first merged PR) |
| `LICENSE` | MIT licence |
| `pyproject.toml` | Python package definition: dependencies, optional extras (`qiskit`, `ibm`, `redis`, `pqc`, `dev`), ruff lint settings, and the **import-linter contracts** that keep AI out of the decision code |
| `docker-compose.yml` | One command (`docker compose up --build`) starts Redis, the API, the advisory ops service and the dashboard |
| `.env.example` | Template for environment variables (profile, CORS, API URL, Redis, future IBM token). Copy to `.env`, never commit it |
| `.editorconfig` | Editor formatting rules (spaces, LF line endings) |
| `.gitattributes` | Forces LF line endings in the repo on every OS |
| `.gitignore` | Files git ignores: caches, `node_modules`, secrets, local tool settings |

## `.github/`: GitHub automation

| File | What it does |
|---|---|
| `workflows/ci.yml` | Runs on every push and PR. **Backend job:** ruff lint → no-AI import guard → bandit/semgrep security scan → all tests (core + ops) → bound validation → 17-scenario attack campaign → dependency audit. **Web job:** `npm ci` + type-check + production build |
| `CODEOWNERS` | Which person reviews which folder (fill in usernames, then uncomment) |
| `PULL_REQUEST_TEMPLATE.md` | Checklist shown when opening a PR |
| `ISSUE_TEMPLATE/task.yml` | Form for creating task issues (area, definition of done, phase) |

## `qsentinel/`: the Python backend

| File | What it does |
|---|---|
| `__init__.py` | Package marker, with the layer map in its docstring |
| `config.py` | **All the tunable numbers**: protocol size (n, L), thresholds τ / τ_transfer, alarm limits, commissioning sizes, Merkle batch size. `FAST` is the small profile for tests and the demo |
| `pipeline.py` | **The conductor.** `QSentinel` issues keys, signs, verifies, runs the alarms, writes the ledger and publishes live events. It also keeps the dashboard's read-only verdict store and per-link history, and a lock so concurrent API calls are safe |
| `telemetry.py` | One-way live event bus (kernel → dashboard / AI). Keeps the last 5,000 events in memory; optionally mirrors them to Redis Streams when `QSENTINEL_REDIS_URL` is set (by Shubham Kumar) |

### `qsentinel/quantum/`: L0, the quantum simulator
| File | What it does |
|---|---|
| `__init__.py` | Exports `ChannelModel`, `get_backend`, etc. |
| `types.py` | The three measurement bases: Z, X, Y |
| `backend.py` | The common interface every simulator implements; `ChannelModel` (noise + eavesdropper settings); `RoundResult` |
| `stim_backend.py` | **Default engine.** Exact, fast stabilizer simulation of teleportation, Bell tests and every eavesdropper model (intercept-resend, ancilla probe). 65,536 rounds in ~30 ms |
| `qiskit_backend.py` | Same interface on IBM's Qiskit Aer, used to cross-check Stim; includes Bell-pair correlators (by Shubham Kumar) |
| `chsh_direct.py` | Independent CHSH experiment with real rotated measurement angles, a cross-check of the D3 input (by Shubham Kumar) |
| `ibm_backend.py` | Placeholder for running on real IBM quantum hardware (Phase 4) |

### `qsentinel/qds/`: L1, the signature protocol
| File | What it does |
|---|---|
| `__init__.py` | Exports the protocol functions |
| `keys.py` | `PrivateKey` (Alice's secret directions, one-time use) and `PublicKeyHandle` (a verifier's teleported copy) |
| `protocol.py` | `keygen`, `distribute`, `sign`, `verify`: the signature scheme itself. `verify` returns a measurement transcript; it does **not** decide |
| `symmetrise.py` | Shuffles verifiers' key copies so a cheating signer can't treat them differently (anti-repudiation) |

### `qsentinel/detect/`: L2, the trust kernel (decisions happen here, no AI allowed)
| File | What it does |
|---|---|
| `__init__.py` | Exports; states the no-AI rule |
| `base.py` | Shared forms: `Severity`, `DetectorResult`, `DetectionContext` |
| `engine.py` | Runs D1–D6, decides ACCEPT/REJECT (any critical = reject), writes the **proof certificate**, updates the channel memory |
| `d1_eigenstate.py` | D1: did every coin match? (informational) |
| `d2_forgery.py` | D2: too many mismatches in any block → forgery or changed message; exact and Chernoff odds |
| `d3_entanglement.py` | D3: is the link still entangled? CHSH, fidelity, drop vs baseline |
| `d4_channel.py` | D4: eavesdropper check. QBER, SPRT early decision, Pauli fingerprint, CUSUM, Bell-measurement uniformity |
| `d5_replay.py` | D5: nonce, one-time key, counter, timestamp freshness |
| `d6_identity.py` | D6: key owner, verifier permission, **honeypot keys** |
| `registry.py` | Memory for D5 (used nonces/keys/counters per verifier) and D6 (key owners, authorised verifiers, honeypots) |
| `channel_monitor.py` | Per-link memory: frozen commissioning baseline, CUSUM, rolling Bell window |
| `fingerprint.py` | Turns per-basis error rates into a Pauli "fingerprint": which direction Eve listens from, and how much |
| `calibrate.py` | The maths of "how safe": Chernoff and exact binomial forgery / false-rejection odds, rounds needed |
| `sequential.py` | Wald SPRT (decide early) and a simple CUSUM helper |
| `validate.py` | Monte-Carlo check that the maths matches a simulated forger (0.9% gap) |

### `qsentinel/pqc/`: post-quantum cryptography
| File | What it does |
|---|---|
| `__init__.py` | Exports |
| `signer.py` | ML-DSA-65 signatures. Uses native OpenSSL (fast, ~0.6 ms) when available, else liboqs, else pure Python. All interoperate |
| `kem.py` | Hybrid key agreement: X25519 + ML-KEM-768 (native OpenSSL preferred), combined with HKDF-SHA3 |
| `channel.py` | Authenticated encrypted tunnel between nodes: signed handshake, ChaCha20-Poly1305, replay/reorder/reflection protection |

### `qsentinel/ledger/`: L3, the blockchain
| File | What it does |
|---|---|
| `__init__.py` | Exports |
| `hashchain.py` | The tamper-evident diary: each entry chained to the previous hash and ML-DSA-signed; Merkle anchoring; inclusion proofs; listeners (used to stream ledger events to the dashboard) |
| `merkle.py` | RFC 6962-style Merkle trees: roots, inclusion proofs, verification |
| `commit_reveal.py` | Commitments for the symmetrisation shuffle; joint random seed |
| `audit.py` | External auditor: rebuild replay state, check anchors, check reveals, **find disputes** (cheating signers) |

### `qsentinel/attacks/`: L4, the practice hacker
| File | What it does |
|---|---|
| `__init__.py` | Exports |
| `library.py` | All 14 attack scenarios, what each must trigger, and the information-vs-disturbance meter |
| `run.py` | Runs a YAML campaign, prints PASS/FAIL, exits 1 on failure (used by CI) |
| `sweep.py` | Detection rate vs attack strength (CLI, and behind `POST /sweeps`) |
| `campaigns/smoke.yaml` | The 17 fast scenarios CI runs |
| `campaigns/full.yaml` | The same at full protocol size, for the security report |

### `qsentinel/api/`: the web API
| File | What it does |
|---|---|
| `__init__.py` | Package marker |
| `main.py` | FastAPI app on port 8000. **Status:** `/health`, `/overview`, `/participants`. **Sign/verify:** `/sign`, `/verify`, `/verdicts`, `/verdicts/{i}`. **Red team:** `/attacks`, `/attacks/run`, `/sweeps`. **Ledger:** `/ledger`, `/ledger/verify`, `/ledger/audit`, `/ledger/anchor`, `/ledger/proof/{i}`. **Channels:** `/links`, `/calibration`. **Live:** `/telemetry`, `/ws/telemetry`. Also API-key role-based access control |

## `ops/`: the advisory AI service (separate package; can't touch decisions)
| File | What it does |
|---|---|
| `pyproject.toml` | Its own dependencies (scikit-learn, FastAPI). Deliberately does **not** depend on `qsentinel` |
| `README.md` | What the ops plane is and how to run it |
| `qsentinel_ops/__init__.py` | The `ADVISORY - NOT A TRUST DECISION` label every output carries |
| `qsentinel_ops/clustering.py` | Groups alert storms into incidents (DBSCAN) from the API's telemetry |
| `qsentinel_ops/narration.py` | Plain-English incident summaries (deterministic template; LLM phrasing planned) |
| `qsentinel_ops/server.py` | Small FastAPI service on port 8100: `/incidents`, `/health`. Used by the dashboard's Ops page |

## `web/`: the dashboard ("Trust Console")
| File | What it does |
|---|---|
| `package.json` / `package-lock.json` | Dependencies and scripts (`npm run dev`, `npm run build`) |
| `vite.config.ts` | Build tool config; splits big libraries (Three.js, charts) into separate cached files |
| `tsconfig.json` | TypeScript settings (strict mode) |
| `index.html` | The single HTML page |
| `src/main.tsx` | Starts React with the data-fetching client and the router |
| `src/App.tsx` | The page routes; pages load on first visit |
| `src/index.css` | Tailwind CSS |
| `src/api/types.ts` | TypeScript shapes of every API response |
| `src/api/client.ts` | All calls to the API and the ops service; API key handling; serves recorded data in replay mode |
| `src/state/telemetry.ts` | Live event store, WebSocket connection (auto-reconnect), REJECT pop-ups, replay player |
| `src/state/session.ts` | Session recorder: save a live demo as JSON, replay it with no backend |
| `src/state/ui.ts` | Presenter Mode on/off |
| `src/lib/attribution.ts` | Fixed rules that turn alarms into a label like "Probe in Z basis (stealth)". Presentation only, not ML |
| `src/lib/physics.ts` | Display maths: ellipsoid axes, CHSH, exact/Chernoff odds for the calculator, number formatting |
| `src/lib/merkle.ts` | In-browser SHA3 Merkle proof check (same construction as the backend) |
| `src/lib/events.ts` | Helpers to pick verdict events out of the live feed |
| `src/components/Layout.tsx` | Top bar (health, live dot, "AI in trust path: NO", record, Presenter Mode), side menu, pop-ups |
| `src/components/ui.tsx` | Shared building blocks: cards, pills, stats, sliders, gauges, the hatched advisory frame |
| `src/components/ChannelEllipsoid.tsx` | 3-D sphere that squashes into an ellipsoid when Eve probes (axis = 1 − 2 × error rate) |
| `src/components/EllipseThumb.tsx` | Small 2-D version for link cards |
| `src/components/SeriesChart.tsx` | Line charts and sparklines with threshold lines |
| `src/components/VerdictParts.tsx` | Proof-certificate pieces: detector cards, block heatmap, CHSH gauge, fingerprint panel, Bell bars, Merkle ladder, QR/export, info meter |
| `src/demo/PresenterMode.tsx` | The 7-step guided demo that runs real attacks and moves between pages |
| `src/pages/MissionControl.tsx` | Home: KPIs, link health, quick-demo buttons, live alert feed |
| `src/pages/Journey.tsx` | One signature animated through all layers |
| `src/pages/AttackLab.tsx` | Launch any attack, sweeps, and the 17-scenario campaign |
| `src/pages/VerdictInspector.tsx` | The full proof certificate for any verdict |
| `src/pages/Channels.tsx` | Channel Observatory: baseline vs now, 3-D ellipsoid, probes, charts |
| `src/pages/LedgerExplorer.tsx` | The chain, anchors, Merkle proofs and the auditor |
| `src/pages/Transferability.tsx` | Cheating signer vs the commit-reveal shuffle |
| `src/pages/Bounds.tsx` | Interactive "how safe are we?" calculator |
| `src/pages/OpsPlane.tsx` | Advisory AI incidents, fenced off |
| `src/pages/Settings.tsx` | API key, endpoints, offline replay |

## `deploy/`: containers
| File | What it does |
|---|---|
| `Dockerfile.api` | API image; fails to build if any ML library sneaks in |
| `Dockerfile.ops` | Advisory ops image (the only image with scikit-learn) |
| `Dockerfile.web` | Builds the dashboard, then serves it with nginx |
| `nginx.conf` | Serves the dashboard; page refreshes on deep links work; long-cache for assets |

## `tests/`: automatic checks (`pytest`)
| File | What it proves |
|---|---|
| `test_quantum.py` | Teleportation physics, eavesdropper error rates, CHSH, Stim vs Qiskit agreement |
| `test_chsh_direct.py` | The rotated-angle CHSH agrees with the value D3 uses |
| `test_qds.py` | Honest signatures always verify; keys are one-time; JSON round-trip |
| `test_detectors.py` | Every attack is caught by its alarm; no false alarms; honeypot; CUSUM; frozen baseline |
| `test_fingerprint.py` | Pauli fingerprint finds the probed axis and its size; documents the random-basis blind spot |
| `test_calibrate.py` | Security numbers, exact ≤ Chernoff, simulator agreement, SPRT speed |
| `test_pqc.py` | ML-DSA implementations interoperate; hybrid KEM; tunnel rejects tamper/replay/MITM |
| `test_ledger.py` | Tamper detection, Merkle proofs, anchoring, restart-safe replay protection, disputes, commit-reveal |
| `test_api.py` | Endpoints end-to-end, including verdict store, overview, sweeps, probes and access control |
| `test_telemetry.py` | Event bus and the Redis mirror (with a fake Redis) |
| `test_ops.py` | Advisory clustering and narration service |
| `test_no_ml_in_trust_path.py` | No AI library is imported by or loaded into the decision code |

## `docs/`: guides
| File | What it's for |
|---|---|
| `FILE_GUIDE.md` | This file |
| `code-walkthrough.md` | Function-by-function explanation of detection, cybersecurity and blockchain |
| `detection-security-blockchain.md` | How those three parts work, with results and commands |
| `architecture.md` | The six layers and the one-way data rule |
| `protocol.md` | The signature protocol and its security maths |
| `frontend-spec.md` | The dashboard specification (now implemented in `web/`) |
| `roles.md` | Team roles, owned folders, task checklist |
| `roadmap.md` | Phases P0–P5 and which tools come when |

## Other folders
| File | What it's for |
|---|---|
| `chain/README.md`, `chain/chaincode/` | Plan and placeholder for the Hyperledger Fabric network (Phase 3) |
| `notebooks/README.md` | Planned Jupyter notebooks for the security report |
| `scripts/github_setup.sh` | One-time script to create the repo, invite teammates and add starter issues |
