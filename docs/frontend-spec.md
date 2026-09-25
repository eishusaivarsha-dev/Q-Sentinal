# Q-SENTINEL Trust Console: frontend specification

> **How to use this document with an AI assistant**
> Paste this whole file, then say:
> *"Build the Q-SENTINEL Trust Console described here inside the existing `web/` Vite + React 18 + TypeScript + Tailwind project. Use only the API endpoints listed in §10 as BUILT. For anything marked NOT BUILT, put the call behind the hooks in `src/api/hooks.ts` and return the sample JSON from §11 until the backend exists. Never compute an ACCEPT/REJECT verdict in the browser. Start with the MVP scope in §13."*

---

## 1. What this is

Q-SENTINEL verifies **quantum digital signatures**. Its security comes from physics, not from hard maths.
- A signer teleports quantum public keys to verifiers.
- Six closed-form detectors (D1–D6, **no AI**) decide ACCEPT/REJECT.
- Every verdict is written to a post-quantum-signed ledger (a hash chain signed with ML-DSA, plus Merkle anchors).
- An attack simulator attacks the system to prove the detectors work.

The **Trust Console** is the L5 operations plane from the dossier (FR-15, deliverable D11). It is the only part most people will ever see, so it has to make four audiences believe the system works:

| Audience | What they need from the UI |
|---|---|
| **SOC analyst** | What is happening, how bad is it, what kind of attack, in **< 60 seconds** (NFR-13) |
| **SIH judges** | A **< 6 minute** guided story: honest → attacked → detected → provably recorded (D16) |
| **Auditor / regulator** | "Hand a regulator a proof instead of a confusion matrix": every verdict opens into its proof certificate and Merkle proof |
| **Red team** | Launch any of the 14 attack types at any strength, and see which detector fires and why |

## 2. Design principles (these keep the UI consistent with the architecture)

1. **The UI observes, it never decides.** The browser displays verdicts and certificates produced by the backend. It never re-derives ACCEPT/REJECT. Client-side maths such as the CHSH formula or the ellipsoid axes is for *display only*.
2. **Every number is traceable.** Any statistic on screen links to the verdict certificate or ledger entry it came from.
3. **The AI is visibly fenced off.** Anything from the advisory ops plane is drawn inside a hatched, amber-bordered frame labelled **"ADVISORY - NOT A TRUST DECISION"**. It is never mixed into detector panels. A permanent top-bar badge reads **"AI in trust path: NO"**, sourced from `certificate.ai_in_trust_path`.
4. **Explain, don't just alarm.** Every alert shows *which physical signal* moved (QBER, CHSH, fingerprint axis, nonce…), *which attack class* that means (§8), and *how sure* we are (the bound or p-value).
5. **Physics is shown honestly.** The Bloch sphere, CHSH gauge and fingerprint are exact functions of measured data (§7), not decoration.
6. **Demo-proof.** Any session can be recorded and replayed offline (§9). The dossier's risk plan requires the demo to run off a pre-seeded dataset.

## 3. Information architecture

Left navigation, with views gated by role (roles come from the API key; see §10 auth):

| # | View | Route | Roles | Dossier link |
|---|---|---|---|---|
| 1 | **Mission Control** (overview) | `/` | all | FR-15 |
| 2 | **Signature Journey** (live pipeline) | `/journey` | all | architecture L0–L5 |
| 3 | **Attack Lab** | `/attacks` | redteam, admin | FR-12, D6 |
| 4 | **Verdict Inspector** (proof certificate) | `/verdicts/:ledgerIndex` | analyst+ | FR-5, NFR-10 |
| 5 | **Channel Observatory** | `/channels` | analyst+ | D3, D4 |
| 6 | **Ledger Explorer** | `/ledger` | analyst+ | FR-13, FR-14, D10 |
| 7 | **Transferability Arena** | `/transferability` | analyst+ | FR-14 (repudiation) |
| 8 | **Security Bounds** | `/bounds` | all | D1, D5, NFR-3 |
| 9 | **Ops Plane (advisory AI)** | `/ops` | analyst+ | FR-18, D12 (Phase 4) |
| 10 | **Settings / Access** | `/settings` | all | RBAC |

**Presenter Mode** (§9) is a full-screen overlay that drives views 1–7 automatically.

### Global shell (on every page)
- **Top bar**, populated from `GET /health`:
  - Backend (`stim`), encoding (`six-state`), `L × n`, τ / τ_transfer, ML-DSA implementation, KEM implementation.
  - Auth mode: `dev-open` shows an amber "DEV MODE" chip.
  - Live WebSocket dot (green, amber or red).
  - The **"AI in trust path: NO"** badge.
- **Alert toasts:** a CRITICAL verdict event pops a toast with the attack-class chip (§8). Clicking it opens the Verdict Inspector.
- **Colour language:**

| Meaning | Colour |
|---|---|
| ACCEPT | emerald |
| REJECT / critical | rose |
| Warning | amber |
| Info | slate |
| Basis Z | sky `#38bdf8` |
| Basis X | violet `#a78bfa` |
| Basis Y | green `#34d399` |

  Layer colours (L0 → L5) are used consistently in the Journey and in the ledger.

---

## 4. The views

### 4.1 Mission Control (`/`)
The analyst's 60-second screen.
- **KPI row:**
  - verdicts in the last 5 min, with ACCEPT/REJECT counts
  - open critical and warning alerts
  - links (healthy / warning / critical)
  - ledger status (chain valid ✔ from `GET /ledger/verify`, plus time of last Merkle anchor)
  - disputes (from `GET /ledger/audit`)
- **Link health cards**, one per signer→verifier link from `GET /links`. Each card shows:
  - A QBER sparkline built from telemetry, with the baseline QBER as a dashed line and 11% as a red line.
  - A CHSH mini-gauge (0 to 2.83, with a tick at 2).
  - A CUSUM bar filling towards its threshold (0.03).
  - The latest fingerprint label (e.g. "single-axis probe along Z").
  - A small Channel Ellipsoid thumbnail (§7.2).
- **Live alert feed:** the newest verdict events (WebSocket `verdict`). Each row shows time, link, decision pill, attack-class chip (§8), the detectors that fired as coloured chips, and a one-line detail. Click a row to open the Verdict Inspector.
- **Acceptance:** a new intercept attack appears as a toast plus a red feed row within 1 second, and the attack class is readable without clicking.

### 4.2 Signature Journey (`/journey`): the centrepiece
A horizontal, animated pipeline showing **one signature moving through all six layers**. It replays whenever a new verdict arrives, or when the presenter clicks a verdict.

| Stage | Layer | What it shows | Data |
|---|---|---|---|
| ① Key issued | L1 | Key ID; "one-time key" lock icon; honeypot keys are never shown as such | telemetry `key_issued` |
| ② Teleportation | L0 | Bell pair → Bell-state measurement → 2 correction bits → Pauli fix {I,X,Z,XZ}; a travelling-photon animation; if the verdict has D3/D4 alerts, a red "Eve" silhouette appears on the channel | verdict D3/D4 |
| ③ Symmetrisation | L1 + L3 | When >1 verifier: verifiers post commitments on-chain, then shuffle their copies (a card-shuffle animation) | ledger `sym_commit` |
| ④ Measurement | L1 | `L × n` rounds; a grid of `L` blocks coloured by mismatch count against the limit ⌊τn⌋ | `certificate.transcript.block_mismatches`, D2 `tau` |
| ⑤ Detectors | L2 | Six lamps D1–D6 turn green, amber or red one by one (≈150 ms apart), each with its one-line detail; SPRT shows "decided after k rounds" | `verdict.results[]` |
| ⑥ Verdict | L2 | Big ACCEPT/REJECT stamp + attack-class chip + forgery bound (e.g. `≤ 1.0×10⁻¹⁶`) | certificate |
| ⑦ Ledger | L3 | A block slides onto the chain with its entry hash; "Merkle: pending" becomes "anchored" when the anchor lands | `ledger_index`, `merkle_proof` |
| ⑧ Telemetry | L5 | A one-way arrow to "Ops plane (advisory)", drawn with a **one-way valve** icon | - |

Clicking any stage opens the matching panel of the Verdict Inspector.

**Why it matters:** judges see *all four domains* (quantum, cybersecurity, blockchain, AI-at-arm's-length) in one motion, exactly as the dossier's §8.3 describes them.

### 4.3 Attack Lab (`/attacks`)
- **Attack library grid** from `GET /attacks`. Each card shows:
  - the name and a one-sentence plain-English description (§12)
  - the detectors expected to catch it (as chips)
  - the default strength
  - a "Launch" button
- **Launch panel:**
  - Attack picker and **adversary strength slider** (0–100%, starting at `default_strength`).
  - **Honest-noise slider** (depolarising 0–10%).
  - Optional seed field, for reproducibility (the dossier promises "bit-for-bit reproducible").
  - Calls `POST /attacks/run`.
- **Result card:**
  - PASS/FAIL against the expected detector, the decision, and fired against expected detectors.
  - `detail`, with a link to the full Verdict Inspector.
- **Information-vs-disturbance meter**, shown when `metrics` has `eve_accuracy_*`. It's a pair of horizontal bars:
  - "Eve's accuracy if correction bits are public": `eve_accuracy_with_bits`, about 0.67.
  - "…if correction bits are encrypted (post-quantum channel)": `eve_accuracy_without_bits`, about 0.50, with a "= coin flip, zero information" marker.
  - A third bar: "Damage she caused": `disturbance`.
  - Caption: *"Teleportation is a quantum one-time pad; encrypting 2 bits per qubit leaves Eve with nothing but a trail."*
- **Sweep tab:** "detection rate vs strength" curves. For `strength` in 0…1 × `trials`:
  - A stacked line chart of reject rate, alert rate and per-detector firing rates.
  - Strength 0 is labelled "false-alarm rate".
  - MVP: loop `POST /attacks/run` from the client. Later: `POST /sweeps` (NOT BUILT).
- **Campaign tab:** run a preset list (the smoke campaign: 17 runs) and show a results table (PASS/FAIL per row), mirroring `python -m qsentinel.attacks.run`.

### 4.4 Verdict Inspector (`/verdicts/:ledgerIndex`): the proof certificate
One page that *is* the proof. Sections, top to bottom:
1. **Verdict banner:**
   - Decision, attack-class chip, link, "transferred" tag, `tau_applied`.
   - `forgery_exact_per_block` and `forgery_bound_per_block` in scientific notation.
   - `ai_in_trust_path: false`.
2. **Detector drill-down**, six cards. Each shows statistic against threshold on a small bullet gauge, severity, `detail`, and an expandable "why this rule is sound" text (§12).
   - **D2:** a **block heatmap** (L cells, colour = mismatches / limit; failed blocks outlined). Also exact and Chernoff forgery bounds and the honest-rejection bound.
   - **D3:** the **CHSH gauge** from 0 to 2.83, with a red zone ≤ 2 ("classical, entanglement gone") and a marker at 2√2 ("Tsirelson, perfect"). Also fidelity F, pooled fidelity, and "z-drop vs baseline".
   - **D4:** QBER against 11%. SPRT: decision, `sprt_rounds` and "rounds saved". The **Fingerprint panel** (§7.1). CUSUM bar. BSM uniformity (4 bars, target 25% each, χ² p-value).
   - **D5:** a freshness checklist (nonce, one-time key, counter, timestamp), each ticked or crossed.
   - **D6:** a binding checklist (key→signer, key→verifier, RBAC, honeypot). If `extra.honeypot`, show a trap icon: "Signature is physically valid - caught by honeypot".
3. **Transcript:** `digest_hex`, `total_rounds`, `seed`, `backend`, `transcript_hash`.
4. **Ledger and Merkle proof:**
   - `ledger_index` and `ledger_entry_hash`.
   - If `merkle_proof` is an object, draw the audit path as a vertical ladder (leaf → siblings L/R → root) with a **"Verify in browser"** button. It recomputes SHA3-256 with prefix 0x00 for the leaf and 0x01 for each node, in RFC 6962 order, and shows ✔.
   - Otherwise show "pending anchor", with an admin button calling `POST /ledger/anchor`, then `GET /ledger/proof/{i}`.
5. **Export:**
   - Download the certificate JSON.
   - Print to PDF, with a print stylesheet.
   - **QR code** that encodes `…/api/ledger/proof/{index}`, so anyone can check the Merkle proof from a phone.
   - STIX 2.1 bundle (Phase 5, §10).

### 4.5 Channel Observatory (`/channels`)
One tab per link (`GET /links`).
- **Frozen baseline vs now:**
  - The baseline (per-basis error rates, QBER, correlators, commissioning pairs) is shown in a "sealed" card: *"Measured at commissioning, recorded on the ledger, never adapted by traffic."*
  - Next to it: the latest values from telemetry and verdicts.
- **Channel Ellipsoid** (Three.js, §7.2): a large 3D view. The ghost sphere is the baseline; the solid ellipsoid is now. The six eigenstates are shown as coloured dots. The **dominant damage axis glows** and is labelled with the fingerprint label.
- **Time series** (Recharts), built from the telemetry history:
  - QBER per verification, with baseline and 11% lines.
  - CHSH S, with lines at 2 and 2.83.
  - CUSUM value, with threshold.
  - Fingerprint p-value on a log scale, with the α = 1e-4 line.
- **Pauli bars:** `pauli` against `baseline` (pX, pY, pZ) as grouped bars, the excess highlighted, and "Estimated intercepted fraction ≈ `est_intercept_fraction`".

### 4.6 Ledger Explorer (`/ledger`)
- **Chain strip:** a horizontally scrolling row of blocks (`GET /ledger`), coloured by `kind`:

| Kind | Colour |
|---|---|
| `verdict` | emerald or rose, by decision |
| `merkle_anchor` | gold |
| `link_commissioned` | sky |
| `sym_commit` | violet |
| `sym_reveal` | violet outline |

  Each block shows its index, the short `entry_hash` and `prev_hash`, with arrows linking them. Clicking opens its payload JSON and the ML-DSA signature (truncated).
- **Verify chain** button: `GET /ledger/verify` → ✔ "N entries verified".
- **Merkle anchor view:** click an anchor to draw its tree (members = leaves). Clicking a leaf highlights its proof path.
- **Audit panel** (`GET /ledger/audit`): chain_ok, anchor problems, symmetrisation (committed / revealed / unrevealed / problems), and **disputes** as red cards: "Transferability violation: bob ACCEPT (direct) vs charlie REJECT (forwarded) - signer equivocation suspected".
- **Tamper demo** (presenter-only, client-side copy): edit one payload in a *local copy* and re-run verification in the browser to show the chain break. It never writes to the server.

### 4.7 Transferability Arena (`/transferability`)
Explains the repudiation attack and its blockchain defence visually.
- Two verifier columns: **Bob (direct, τ = 0.10)** and **Charlie (forwarded, τ_transfer = 0.14)**.
- A toggle **"Symmetrisation ON/OFF"** runs `repudiation` or `repudiation_unprotected` at a tampering slider δ (0.1–0.4).
- Animation:
  1. Alice sends Charlie a damaged copy (red speckles on his key grid).
  2. With symmetrisation on, the commit-reveal steps play: both verifiers post hashes to the chain → reveal → shuffle, and the red speckles spread evenly across both grids.
- Outcome banner:
  - OFF + split: *"Alice split the verifiers - ledger audit flagged a dispute"*
  - ON: *"Transferability holds - Alice cannot split the verifiers"*
- **Evidence chart:** violation rate vs δ, with and without symmetrisation. Values from the backend sweep (full size): unprotected **100% split at δ ≥ 0.2, all flagged**; protected **0% split at every δ**.

### 4.8 Security Bounds (`/bounds`)
- A table and chart from `GET /calibration`: rounds `n` needed for a forgery probability ≤ 10⁻¹⁶ against noise tolerance τ, for two-basis and six-state.
- An **interactive calculator** (display-only, client-side): sliders for n, τ and basis set. It shows the Chernoff bound `exp(−n·KL(τ‖q))` and the exact binomial `P[Bin(n,q) ≤ ⌊τn⌋]` on a log scale, with the headline `(3/4)^128 = 1.02×10⁻¹⁶` pinned.
- **Empirical check** card: "Simulator Monte-Carlo: 0.01358 vs exact 0.01370 (0.9% error)", from `python -m qsentinel.detect.validate`.

### 4.9 Ops Plane (`/ops`), Phase 4, advisory only
- The whole page sits inside the **AdvisoryFrame**: a hatched border and the permanent label "ADVISORY - NOT A TRUST DECISION".
- **Incidents:** clusters of alerts (DBSCAN in `ops/qsentinel_ops/clustering.py`). Each cluster card shows its member verdicts, which link to the Inspector.
- **Narrative:** the LLM-written incident summary. It always shows the underlying certificate beside it: "Ground truth ↓".
- Until `GET /ops/incidents` exists (NOT BUILT), show a disabled state explaining the Phase 4 plan.

### 4.10 Settings / Access (`/settings`)
- An API key field, stored in `sessionStorage` only and sent as the `X-API-Key` header; the WebSocket uses `?key=`.
- Shows the resolved identity and roles.
- Explains dev mode.
- Backend URL (`VITE_API_URL`).
- Theme (dark default, with light).

---

## 5. Interaction flows (end to end)

1. **Honest signature (analyst):**
   - Attack Lab → "honest" → a toast.
   - The Journey animates green lamps. The Inspector shows D1 "all outcomes deterministic", CHSH 2.83, a perfect sphere, and "Merkle: pending".
   - After 8 verdicts the anchor lands and the Merkle ladder appears.
2. **Intercept-resend slider (red team):**
   - Drag strength from 0.1 to 1.0 and launch each time.
   - QBER climbs to 33%, CHSH drops below 2, the ellipsoid shrinks towards radius ⅓, and D3/D4 go red.
   - The info meter shows 0.67 against 0.50.
3. **Stealth probe (analyst):**
   - `stealth_probe` at 3% (full profile) gives **ACCEPT**, plus an amber D4 "fingerprint drift - single-axis probe along Z".
   - The ellipsoid squashes into a **cigar along Z**, and the estimate reads ≈ 3%.
   - Repeated runs fill the CUSUM bar until it raises a channel alarm.
4. **Stolen keystore:** D2 green and D6 red, with a trap icon: "physically valid, still caught".
5. **Repudiation:** the Transferability Arena, ON against OFF, then the ledger dispute card.
6. **Auditor:** Ledger Explorer → verify chain ✔ → open an anchor → click a leaf → proof path ✔ → scan the QR on a phone.

## 6. Real-time model
- **WebSocket** `/ws/telemetry` pushes `{seq, ts, kind, data}`. Kinds today: `key_issued` and `verdict`.
- Keep a ring buffer of 5,000 events in a Zustand store. Derive per-link time series from the verdict events: `data.link`, `data.qber`, `data.chsh`, `data.fingerprint`, `data.alerts`.
- **REST** via TanStack Query:
  - `/health`: every 30 s
  - `/links` and `/ledger/audit`: every 5 s, or refetch on each verdict event
  - `/ledger`: every 3 s on the Ledger page
- A full verdict (the certificate) comes back from `POST /attacks/run` and `POST /verify`; cache it by `certificate.ledger_index`. For verdicts produced elsewhere, use `GET /verdicts/{index}` (NOT BUILT, see §10) or show the telemetry summary.
- If the WebSocket drops, fall back to polling `GET /telemetry?since=<lastSeq>`.

## 7. Physics visualisations (exact formulas; display only)

### 7.1 Fingerprint panel
Input: `D4.extra.fingerprint`.
- Three bars for the per-basis error rates `rates.Z`, `rates.X`, `rates.Y`, each with a ghost bar for `baseline_rates`.
- Pauli vector bars `pauli.pX`, `pY`, `pZ` with `excess_pauli` highlighted.
- The `label` in large text.
- `p_value` (G-test) with its α line.
- `est_intercept_fraction` as a percentage.
- Small print, always visible: "An attacker choosing random bases looks isotropic, like noise. She is caught by magnitude (QBER/CUSUM), not shape."

### 7.2 Channel Ellipsoid (the Bloch sphere, made meaningful)
A Pauli channel shrinks the Bloch sphere into an ellipsoid. Its semi-axes come **directly from the per-basis error rates**:

```
axis_X = 1 − 2·rates.X      axis_Y = 1 − 2·rates.Y      axis_Z = 1 − 2·rates.Z
```

(Because r_X = pY + pZ, and a Pauli channel scales the Bloch x-component by 1 − 2(pY + pZ). The same holds for y and z.)

| Channel | Shape |
|---|---|
| Honest, no noise | the unit sphere |
| Depolarising noise | a uniformly smaller sphere |
| Eve probing in Z | a **cigar along Z** (X and Y shrink) |
| Full random-basis intercept | a sphere of radius ⅓ |

- Draw the baseline as a transparent wireframe and "now" as a solid translucent mesh.
- Show the six eigenstates as coloured dots on the unit sphere.
- Add an arrow and glow on the axis with the largest `excess_pauli`.
- Use `rates` from the latest verdict on that link. Use the link's `baseline.per_basis` (errors/total) for the ghost.

### 7.3 CHSH and fidelity
```
S = √2 · (ZZ + XX)        F = (1 + XX − YY + ZZ) / 4        (from D3.extra.correlators)
```
The gauge's zones: ≤ 2 is "classical: no quantum security"; 2 – 2.83 is "quantum"; 2.83 is "perfect". Use the backend's `chsh` and `fidelity` values for display; the formula is for tooltips.

### 7.4 Block heatmap (D2)
- `block_mismatches[i] / ⌊tau·n⌋`, where `tau` is D2 `extra.tau` and `n` is `transcript.rounds_per_bit`.
- A grid of `hash_bits` cells (e.g. 16×16 for 256); colour 0 → emerald, 1 → amber, > 1 → rose.
- Cells in `failed_blocks` are outlined.
- Tooltip: "digest bit i: m of n rounds mismatched".

## 8. Attack-class chip (deterministic presentation rules; not ML)
Evaluate top to bottom and stop at the first match. This translates detector output into words; it does not change any decision. Put it in `src/lib/attribution.ts` with unit tests.

**Key ordering insight:** D3 measures *spare Bell pairs that no signature touches*. A forger cannot affect them. So a clean D3 with a failed D2 means "the signature is bad", while a disturbed D3 means "someone is on the channel". Check the channel rules (4, 7) **before** the forgery rule (8). Otherwise a forgery, which also raises QBER, gets mislabelled as eavesdropping.

Let `fp = D4.extra.fingerprint` and `single = fp.drift && fp.label.startsWith("single-axis")`.

| # | Condition | Chip |
|---|---|---|
| 1 | `certificate.signature.key_id` appears in `/ledger/audit` disputes | **Repudiation attempt** |
| 2 | D6 alert and `D6.extra.honeypot` | 🪤 **Stolen keystore** (honeypot tripped) |
| 3 | D6 alert and detail contains "not authorised" | **Unauthorised verification** |
| 4 | D6 alert | **Impersonation** |
| 5 | D5 alert and D2 alert | **Key-reuse forgery** |
| 6 | D5 alert | **Replay** |
| 7 | D3 alert (any severity) **or** `single` | if `single`: **Probe in {axis} basis** (axis = letter after "along "), with **(stealth)** appended when the decision is ACCEPT; else **Intercept-resend / entanglement attack** |
| 8 | D2 alert | **Forgery / message tampering** |
| 9 | D4 critical | **Intercept-resend (channel)** |
| 10 | `D4.extra.cusum_alarm` | **Sustained low-level channel attack** |
| 11 | `fp.drift` | **Low-level channel anomaly** |
| - | otherwise | **Nominal** |

Validated against real backend output for all 14 attack types, at both profiles (FAST and full), with and without 3% noise:

| Attack | Chip produced |
|---|---|
| honest (noisy) | Nominal |
| blind / partial forgery, MITM swap | Forgery / message tampering |
| intercept-resend (random basis) | Intercept-resend / entanglement attack |
| entangle-and-measure | Probe in Z basis |
| stealth probe | Probe in Z basis (stealth) |
| replay | Replay |
| key reuse | Key-reuse forgery |
| repudiation, unprotected | Repudiation attempt |
| repudiation, protected | Forgery / message tampering (both verifiers reject consistently) |
| impersonation | Impersonation |
| unauthorised verification | Unauthorised verification |
| stolen keystore | Stolen keystore |

## 9. Presenter Mode and offline replay
- **Presenter Mode:** a full-screen stepper with big captions and a timer. Each step calls the API and navigates to the right view.

| Step | Time | What happens |
|---|---|---|
| 1 | 0:00 | **Commission and honest:** `honest`. Sphere perfect, CHSH 2.83, ACCEPT. *"Honest signatures verify with certainty."* |
| 2 | 0:40 | **Blind forgery:** heatmap all red, bound 10⁻¹⁶. *"A forger has to guess; physics punishes guessing exponentially."* |
| 3 | 1:20 | **Intercept slider** 0.1 → 1.0: QBER to 33%, CHSH below 2, ellipsoid collapses, info meter. *"Encrypt the two correction bits and Eve learns nothing."* |
| 4 | 2:30 | **Stealth probe** 3%: ACCEPT + amber, cigar along Z, "≈3%". *"Below every threshold, still named and measured."* |
| 5 | 3:20 | **Replay**, then **stolen keystore**: D5, then the D6 honeypot. |
| 6 | 4:00 | **Repudiation** OFF, then ON (Transferability Arena). *"The blockchain isn't decoration; it makes signatures transferable."* |
| 7 | 5:00 | **Ledger:** verify chain, open the Merkle proof, scan the QR. *"AI in trust path: NO. Here is the proof."* |

- **Session recorder:** a Record button captures every REST response and WebSocket event, with timestamps, into a JSON file you can download.
- **Replay mode:** loads that file (or `web/public/demo-session.json`) and plays it back with the original timing, with **no backend needed**. This is the dossier's "demo runs off a pre-seeded dataset" risk control. Show a small "REPLAY" watermark.

## 10. API contract

Base URL: `VITE_API_URL` (default `http://localhost:8000`). Auth header: `X-API-Key`, not needed in dev mode.

### BUILT (available now)
| Method | Path | Role | Returns |
|---|---|---|---|
| GET | `/health` | public | config + implementations + auth mode |
| POST | `/sign` `{signer_id, message}` | signer | `Signature` |
| POST | `/verify` `{signature, verifier_id, transferred, channel:{depolarizing, intercept_fraction, entangle_fraction}}` | verifier | `Verdict` |
| GET | `/attacks` | public | `AttackInfo[]` |
| POST | `/attacks/run` `{attack, strength?, seed?, channel?}` | redteam | `AttackRun` |
| GET | `/ledger?limit=` | analyst | `LedgerEntry[]` |
| GET | `/ledger/verify` | analyst | `{ok, detail}` |
| GET | `/ledger/audit` | analyst | `Audit` |
| POST | `/ledger/anchor` | admin | force a Merkle anchor |
| GET | `/ledger/proof/{index}` | public | `MerkleProof & {valid}` (404 if pending) |
| GET | `/links` | analyst | `Record<link, LinkStatus>` |
| GET | `/calibration?target=` | public | `{tau, two_basis_n, six_state_n}[]` |
| GET | `/telemetry?since=` | analyst | `TelemetryEvent[]` |
| WS | `/ws/telemetry?key=` | analyst | stream of `TelemetryEvent` |
| POST | `/signers/{id}`, `/verifiers/{id}`, `/honeypots/{signer}` | admin | enrolment |

### ADDED since the first version of this spec (all implemented in `qsentinel/api/main.py` and used by `web/`)
| Method | Path | Purpose |
|---|---|---|
| - | telemetry `verdict` events now carry `ledger_index`, per-basis `rates`, `pauli`, fingerprint, CUSUM, CHSH | feed rows link to the Inspector; live ellipsoid |
| - | telemetry kind `ledger_entry` (every ledger append) | live ledger updates |
| GET | `/overview` | Mission Control KPIs in one call |
| GET | `/participants` | signers, verifiers, honeypot count |
| GET | `/verdicts?limit=` and `/verdicts/{ledger_index}` | recent verdict summaries; the full `Verdict` for any past verification |
| POST | `/sweeps` `{attack, min, max, steps, trials, noise, full}` | server-side sweep on a throw-away system (same rows as the CLI) |
| - | `channel.eve_bases`, `channel.entangle_basis` on `/verify` and `/attacks/run` | craft single-basis probes from the UI |
| - | `/links` now includes `latest`, `status` and `history` per link | Channel Observatory without polling telemetry |
| GET | `/incidents` on the **ops service** (port 8100, `ops/qsentinel_ops/server.py`) | advisory clusters + narration |

### Still open
| Method | Path | Purpose |
|---|---|---|
| GET | `/report` | FR-16 security report data (today: print the Verdict Inspector / download certificates) |

## 11. Data types (TypeScript), matching real responses

```ts
type Severity = "info" | "warning" | "critical";
type Decision = "ACCEPT" | "REJECT";

interface Health { status: "ok"; backend: string; basis_set: "six-state" | "two-basis";
  hash_bits: number; rounds_per_bit: number; tau: number; tau_transfer: number;
  symmetrise: boolean; pqc: string; kem: string; auth: "dev-open" | "api-keys"; }

interface Signature { signer_id: string; key_id: string; message: string; nonce: string;
  counter: number; timestamp: number; revealed_bases: number[][]; revealed_values: number[][]; }

interface Fingerprint { rates: {Z: number; X: number; Y: number};
  baseline_rates: {Z: number; X: number; Y: number} | null;
  pauli: {pX: number; pY: number; pZ: number} | null;
  excess_pauli: {pX: number; pY: number; pZ: number} | null;
  g_stat: number; p_value: number; drift: boolean; label: string;
  est_intercept_fraction: number | null; }

interface DetectorResult { detector: "D1"|"D2"|"D3"|"D4"|"D5"|"D6"; name: string; alert: boolean;
  severity: Severity; statistic: number | null; threshold: number | null; detail: string;
  extra: Record<string, unknown>; }
// D2.extra: {tau, failed_blocks:number[], forgery_bound_per_block, forgery_exact_per_block,
//            honest_rejection_bound_per_block, honest_rejection_exact_per_block}
// D3.extra: {chsh, fidelity, correlators:{ZZ,XX,YY}, z_drop_vs_baseline, pooled_fidelity, pooled_pairs}
// D4.extra: {qber, sprt_decision:"attack"|"honest"|"undecided", sprt_rounds, sprt_p0,
//            rounds_saved_by_sprt, fingerprint: Fingerprint, cusum, cusum_alarm, bsm_counts:number[4], chi2_p}
// D6.extra: {honeypot: boolean}

interface MerkleProof { index: number; leaf: string; root: string; anchor_index: number;
  proof: ["L" | "R", string][]; }

interface Certificate { decision: Decision; issued_at: number;
  protocol: {basis_set: string; hash_bits: number; rounds_per_bit: number; tau_applied: number; transferred: boolean};
  transcript: {key_id: string; verifier_id: string; digest_hex: string; block_mismatches: number[];
               total_rounds: number; qber: number; rounds_per_bit: number; seed: number; backend: string};
  signature: {signer_id: string; key_id: string; nonce: string; counter: number};
  link: string; forgery_bound_per_block: number; forgery_exact_per_block: number;
  channel_fingerprint: string; alerts: string[]; ai_in_trust_path: false; transcript_hash: string;
  ledger_index: number; ledger_entry_hash: string; merkle_proof: MerkleProof | "pending"; }

interface Verdict { decision: Decision; results: DetectorResult[]; certificate: Certificate; }

interface AttackInfo { name: string; expected: "ACCEPT" | "REJECT" | "-"; detectors: string[]; default_strength: number; }
interface AttackRun { attack: string; strength: number; decision: Decision; fired: string; expected: string;
  result: "PASS" | "FAIL"; detail: string;
  metrics: Partial<{probed_fraction: number; eve_accuracy_with_bits: number;
                    eve_accuracy_without_bits: number; disturbance: number;
                    violation: boolean; disputes: number}>;
  verdict: Verdict; }

interface TelemetryEvent { seq: number; ts: number; kind: "key_issued" | "verdict";
  data: { decision?: Decision; verifier_id?: string; key_id?: string; signer_id?: string; link?: string;
          transferred?: boolean; qber?: number; chsh?: number; fingerprint?: string;
          alerts?: DetectorResult[] }; }

interface LinkStatus { baseline: {per_basis: Record<"0"|"1"|"2", [number, number]>; qber: number;
    correlators: {ZZ: number; XX: number; YY: number}; pairs: number};
  verifications: number; cusum: number; cusum_alarms: number; }   // per_basis key: 0=Z 1=X 2=Y, value [errors,total]

type LedgerKind = "verdict" | "merkle_anchor" | "link_commissioned" | "sym_commit" | "sym_reveal";
interface LedgerEntry { index: number; timestamp: number; kind: LedgerKind; prev_hash: string;
  payload_hash: string; payload: Record<string, unknown>; entry_hash: string; signature: string; }

interface Audit { chain_ok: boolean; chain_detail: string; anchor_problems: string[];
  symmetrisation: {committed: number; revealed: number; unrevealed: string[]; problems: string[]};
  disputes: {key_id: string; nonce: string; finding: string;
             verdicts: Record<string, {decision: Decision; transferred: boolean}>}[];
  ok: boolean; }
```

### Sample responses (use these as mocks)
```json
// GET /links
{"alice->bob": {"baseline": {"per_basis": {"0": [0, 9829], "1": [0, 10024], "2": [0, 10147]}, "qber": 0.0,
  "correlators": {"ZZ": 1.0, "XX": 1.0, "YY": -1.0}, "pairs": 4000},
  "verifications": 1, "cusum": 0.013, "cusum_alarms": 0}}

// AttackRun.metrics for intercept_resend @ 0.5
{"probed_fraction": 0.52, "eve_accuracy_with_bits": 0.646, "eve_accuracy_without_bits": 0.503, "disturbance": 0.33}

// Audit.disputes[0]
{"key_id": "k-2360360630558964031", "nonce": "f882fc92178fd716a711234f041e8adf",
 "verdicts": {"bob": {"decision": "ACCEPT", "transferred": false},
              "charlie": {"decision": "REJECT", "transferred": true}},
 "finding": "transferability violation - signer equivocation (repudiation attempt) or a dishonest verifier"}
```

## 12. Copy deck (plain-English text the UI shows)

**Detectors:**
- **D1:** "Honest signatures are eigenstates: every measurement must come out exactly as revealed."
- **D2:** "A forger must guess the basis of every qubit; each wrong guess shows up as a mismatch with probability ≥ 1/3."
- **D3:** "Real entanglement beats the classical limit S = 2. If S falls to 2, the channel was tampered with."
- **D4:** "Eavesdropping leaves errors. Which basis the errors hit reveals how she is listening."
- **D5:** "Physics forbids copying the quantum key, so a replay can only be an old classical message; nonces and one-time keys stop it."
- **D6:** "Keys are bound to their owner and verifiers to their role. Decoy keys catch stolen keystores."

**Attacks:**
- **Blind forgery:** guesses everything.
- **Partial-key forgery:** knows part of the key.
- **Intercept-resend:** measures qubits in transit.
- **Entangle-and-measure:** copies qubits into her own memory.
- **Stealth probe:** listens to so few qubits that the error rate stays "normal".
- **Replay:** re-sends an old signature.
- **Key-reuse forgery:** reuses a spent one-time key.
- **MITM swap:** changes the message, keeps the signature.
- **Repudiation:** the signer cheats so she can deny later.
- **Impersonation:** claims someone else's key.
- **Unauthorised verification:** someone without the right tries to verify.
- **Stolen keystore:** signs with a stolen key.

## 13. Build plan

**MVP, for the 36-hour finale.** Extend the existing `web/src` components (AttackPanel, ChannelChart, VerdictCard, AlertFeed, BlochSphere):
1. Shell + top bar + router + TanStack Query + WebSocket store
2. Mission Control
3. Attack Lab (launch + result + info meter)
4. Verdict Inspector (banner, D1–D6 cards, heatmap, CHSH gauge, fingerprint)
5. Channel Ellipsoid (upgrade `BlochSphere.tsx`)
6. Signature Journey
7. Presenter Mode + session recorder/replay

**Next:**
8. Ledger Explorer + Merkle verify-in-browser + QR
9. Transferability Arena
10. Security Bounds
11. Sweep tab
12. Print/PDF certificate

**Phase 4/5:**
13. Ops Plane
14. STIX export
15. `/report`

**Stack** (from the dossier's §5.5): React 18, TypeScript, Vite, TailwindCSS, Recharts (D3 where Recharts can't), Three.js. Add: `react-router-dom`, `@tanstack/react-query`, `zustand`, `qrcode.react`, and `@noble/hashes` (for SHA3-256 in the browser Merkle check). `framer-motion` is optional, for the Journey.

**Suggested structure:**
```
web/src/
  api/        client.ts  types.ts  hooks.ts  ws.ts  mocks.ts
  state/      telemetry.ts  auth.ts  session.ts (recorder/replay)
  lib/        attribution.ts (§8)  physics.ts (§7)  merkle.ts  format.ts (sci notation, %)
  components/ shell/ journey/ verdict/ channel/ attack/ ledger/ ops/
  pages/      MissionControl  Journey  AttackLab  VerdictInspector  ChannelObservatory
              LedgerExplorer  Transferability  Bounds  OpsPlane  Settings
  demo/       script.ts  PresenterMode.tsx
```

## 14. Acceptance checklist
- [ ] No component computes ACCEPT/REJECT. Decisions come only from `verdict.decision`.
- [ ] "AI in trust path: NO" is always visible. All ops-plane output sits inside AdvisoryFrame.
- [ ] A CRITICAL verdict appears (toast + feed) within 1 second of the WebSocket event, with an attack-class chip.
- [ ] A new analyst can name the attack class from Mission Control alone in under 60 seconds (NFR-13).
- [ ] The ellipsoid axes equal `1 − 2·rates` exactly, and a Z-probe renders as a Z-cigar.
- [ ] The Merkle "verify in browser" check matches `valid` from `/ledger/proof/{i}`.
- [ ] Presenter Mode completes all 7 steps in ≤ 6 minutes, online, and fully offline from a recorded session.
- [ ] It works at 1280×720 (projector) and 390 px wide (phone, for the QR scan).
- [ ] The API key is kept in sessionStorage only, and never put in URLs except the WebSocket `?key=` the backend requires.
