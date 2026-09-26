# File guide: what every file does

Every file in the repository, grouped by folder, in plain language. For *how* the code works line by line, see [code-walkthrough.md](code-walkthrough.md). For the big picture, see [architecture.md](architecture.md).

## How the pieces connect

```
 Browser: web/  (React dashboard, "Trust Console", 3-D)
    │  REST + WebSocket (/ws/telemetry)                       │ REST + SSE (/fraud, /copilot, /forecast…)
    ▼                                                         ▼
 qsentinel/api/main.py  (FastAPI, port 8000)          ops/qsentinel_ops/server.py (port 8100)
    │   ▲ POST /reviews/{i}: the ANALYST's fraud decision     ▲   advisory AI: reads telemetry only,
    ▼   │ (signed onto the ledger with the AI's advice)       │   never writes anything back
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
| change a dashboard page | `web/src/pages/console/<Page>.tsx` (landing: `web/src/pages/Landing.tsx`) |
| change how the AI scores fraud | `ops/qsentinel_ops/fraud.py` |
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
| `main.py` | FastAPI app on port 8000. **Status:** `/health`, `/overview`, `/participants`. **Sign/verify:** `/sign`, `/verify`, `/verdicts`, `/verdicts/{i}`. **Red team:** `/attacks`, `/attacks/run`, `/sweeps`. **Ledger:** `/ledger`, `/ledger/verify`, `/ledger/audit`, `/ledger/anchor`, `/ledger/proof/{i}`. **Channels:** `/links`, `/calibration`, `/calibration/far`. **Quantum lab:** `/quantum/teleport`, `/quantum/bsm`. **Fraud decisions (human):** `/reviews`, `/reviews/{i}`. **Report:** `/report/acceptance`. **Live:** `/telemetry`, `/ws/telemetry`. Also API-key role-based access control |

## `ops/`: the advisory AI service (separate package; can't touch decisions)
| File | What it does |
|---|---|
| `pyproject.toml` | Its own dependencies (scikit-learn, FastAPI; `[llm]` adds the Anthropic SDK). Deliberately does **not** depend on `qsentinel` |
| `README.md` | What the ops plane is and how to run it |
| `qsentinel_ops/__init__.py` | The `ADVISORY - NOT A TRUST DECISION` label every output carries |
| `qsentinel_ops/clustering.py` | Groups alert storms into incidents (DBSCAN) from the API's telemetry |
| `qsentinel_ops/narration.py` | Plain-English incident summaries (deterministic template) |
| `qsentinel_ops/anomaly.py` | Ranks the least typical verifications (Isolation Forest) with the features that drove the score |
| `qsentinel_ops/forecast.py` | Per-link QBER / CHSH projection (Holt smoothing) and verifications-to-threshold |
| `qsentinel_ops/fraud.py` | Fraud review queue: risk score 0-100, category, reasons and a *recommended* disposition per verification. The analyst decides |
| `qsentinel_ops/copilot.py` | Sentinel Copilot: Claude (`ANTHROPIC_API_KEY`) or an offline analyst, answering from a read-only situation brief |
| `qsentinel_ops/server.py` | FastAPI service on port 8100: `/incidents`, `/forecast`, `/anomalies`, `/fraud/queue`, `/fraud/cases/{i}`, `/copilot/*`, `/health` |

## `web/`: the dashboard ("Trust Console")
Visual language: "Quantum Observatory" - light pearl / deep-field dark themes, glass cards, React Three
Fiber scenes (hero, protocol story, network, Bloch sphere, ledger chain, risk orb), Lenis smooth
scrolling and Framer Motion. The browser only observes: every ACCEPT/REJECT shown comes from the backend,
and fraud decisions are made by the person using it.

| File | What it does |
|---|---|
| `package.json` / `package-lock.json` | Dependencies and scripts (`npm run dev`, `npm run build`) |
| `vite.config.ts` | Build tool config (port 5173, `@/` alias); splits big libraries (Three.js, charts, motion) into cached files |
| `tailwind.config.js` / `postcss.config.js` | Theme tokens (CSS variables), fonts, animations |
| `index.html` | The single HTML page (fonts, theme applied before first paint) |
| `src/main.tsx` / `src/App.tsx` | React root (query client, router, smooth scroll, click sparks) and the routes: `/` landing, `/console/*` console |
| `src/index.css` | Theme tokens (light/dark), cards, buttons, chips, fields, BorderGlow and print styles |
| `src/api/` | `types.ts` (every response shape), `client.ts` (all calls to the kernel and the ops service; API key in sessionStorage; replay), `hooks.ts` (shared TanStack Query hooks) |
| `src/state/` | `telemetry.ts` (WebSocket feed, toasts, replay), `session.ts` (record / replay a demo), `ui.ts` (theme, copilot drawer, Presenter Mode) |
| `src/lib/` | `attribution.ts` (fixed rules naming the attack class), `physics.ts` (display maths), `format.ts`, `merkle.ts` (in-browser SHA3 proof check), `events.ts`, `cn.ts` |
| `src/three/` | 3-D scenes: `HeroScene` (landing), `StoryScene` (scroll-driven protocol), `QuantumNetwork` (live links), `BlochSphere` (teleportation + channel ellipsoid), `LedgerChain` (the chain), `RiskOrb` (fraud risk), `common.tsx` (sleeping canvas, theme palette, labels) |
| `src/fx/` | Motion toolkit: reveals, split text, count-up, tilt cards, magnetic buttons, Aurora, BorderGlow, AnimatedList, ClickSpark, Lenis smooth scroll |
| `src/components/shell/` | Console layout, sidebar (with open-case badges), top bar, toasts, logo, error boundary, `nav.ts` |
| `src/components/ui/` | Design-system primitives: card, chip, stat, slider, toggle, tabs, meter, empty/error states |
| `src/components/verdict/` | Proof-certificate pieces (banner, detector cards, heatmap, fingerprint, Bell bars, Merkle ladder, QR export), CHSH gauge, alert feed, field guide |
| `src/components/copilot/` | Sentinel Copilot chat (streams from the ops service) and its slide-over drawer |
| `src/components/charts/` | Recharts wrappers in the theme colours, sparkline |
| `src/demo/` | The 7-step Presenter Mode script and its control bar (works offline from a recording) |
| `src/pages/Landing.tsx` | Public landing: 3-D hero, scroll-driven 3-D story, detectors, "AI advises, you decide", live numbers |
| `src/pages/console/MissionControl.tsx` | Live 3-D network, incident card, Bell meter, KPIs, quick actions, link health, live feed, forecast strip |
| `src/pages/console/AttackLab.tsx` | Launch any attack, sweeps, and the 17-scenario campaign |
| `src/pages/console/Verdicts.tsx` | The full proof certificate for any verdict, with the AI's fraud hint |
| `src/pages/console/Channels.tsx` | 3-D channel ellipsoid vs baseline, semi-axes, fingerprint, QBER/CHSH/CUSUM charts, send-through-a-channel probe |
| `src/pages/console/TeleportLab.tsx` | Exact state-vector teleportation on a 3-D Bloch sphere, BSM statistics, OpenQASM export |
| `src/pages/console/Ledger.tsx` | 3-D chain, entries (verdicts, anchors, analyst reviews), chain verify, anchor, auditor |
| `src/pages/console/Journey.tsx` | Sign your own message, then watch it through eight stations on a 3-D stage |
| `src/pages/console/Transferability.tsx` | Cheating signer vs the commit-reveal shuffle, with evidence sweeps |
| `src/pages/console/Bounds.tsx` | Forgery-odds calculator, calibration table, 100k-trial false-alarm check |
| `src/pages/console/FraudReview.tsx` | Fraud queue: AI risk, reasons and suggestion; the analyst picks the disposition and signs it onto the ledger |
| `src/pages/console/Ops.tsx` | Copilot, incidents, forecasts, unusual verifications, fraud queue summary, trust boundary |
| `src/pages/console/Report.tsx` | D1-D6 acceptance (re-runnable) and a printable security report incl. analyst decisions |
| `src/pages/console/Settings.tsx` | API key, endpoints and service status, offline replay, theme |

## `deploy/`: containers
| File | What it does |
|---|---|
| `Dockerfile.api` | API image; fails to build if any ML library sneaks in |
| `Dockerfile.ops` | Advisory ops image (the only image with scikit-learn) |
| `Dockerfile.web` | Builds the dashboard, then serves it with nginx |
| `nginx.conf` | Serves the dashboard; page refreshes on deep links work; long-cache for assets |
| `../Dockerfile`, `start.sh`, `nginx.single.conf.template` | The all-in-one public image: nginx + kernel + advisory AI in separate venvs on one `$PORT` (`/api`, `/ops`) |
| `../render.yaml` | One-click Render blueprint for that image |

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
| `test_api.py` | Endpoints end-to-end, including verdict store, overview, sweeps, probes, analyst reviews and access control |
| `test_telemetry.py` | Event bus and the Redis mirror (with a fake Redis) |
| `test_ops.py` | Advisory clustering, forecasts, anomalies, copilot and the fraud queue (and that the analyst's decision never changes a verdict) |
| `test_statevector.py` | Exact teleportation engine agrees with Stim |
| `test_acceptance.py` | The D1-D6 acceptance report passes on this build |
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
| `notebooks/` | Threshold calibration notebook (`01_calibration.ipynb`) |
| `Q-SENTINEL_D1-D6/` | Anansh Jain's stand-alone D1-D6 reference implementation, kept as delivered. Its criteria also run against the integrated system: `python -m qsentinel.acceptance` |
| `scripts/github_setup.sh` | One-time script to create the repo, invite teammates and add starter issues |
