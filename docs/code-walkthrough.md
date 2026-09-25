# Q-SENTINEL code walkthrough: detection, cybersecurity and blockchain

A file-by-file, function-by-function explanation of the code in:

| Area | Folders |
|---|---|
| 🔍 Detection | `qsentinel/detect/` |
| 🛡️ Cybersecurity | `qsentinel/pqc/`, `qsentinel/attacks/`, the auth part of `qsentinel/api/main.py` |
| ⛓️ Blockchain | `qsentinel/ledger/`, `qsentinel/qds/symmetrise.py`, and the ledger parts of `qsentinel/pipeline.py` |

Functions are referenced **by name**, not line number, so this document stays correct when lines move. Open the file next to this document and read along.

Every number in the worked examples comes from running the real code with the default settings (six-state encoding, `n = 256` rounds per block, `L = 256` blocks).

---

## Part 0: Follow one signature through the code

Read this first. Everything else is detail.

```
pipeline.QSentinel.sign()                         Alice signs
 ├─ issue_key()          → qds.keygen()           make a one-time key
 │                        → qds.distribute()       teleport a copy to every verifier
 │                        → symmetrise_key()       verifiers shuffle copies        ⛓️
 └─ sign_with()          → qds.sign()             reveal one block per hash bit

pipeline.QSentinel.verify()                       Bob checks it
 ├─ commission_link()    (first time on this link) measure normal noise, freeze it   🔍⛓️
 ├─ qds.verify()         → quantum backend         measure the coins → transcript
 ├─ backend.bell_correlators()                     spare Bell pairs for D3
 ├─ detect.evaluate()    → D1…D6                   the six alarms → ACCEPT / REJECT  🔍
 │                        → certificate            the proof
 ├─ ledger.append("verdict")                       write to the diary                ⛓️
 ├─ ledger.anchor()      (every 8 verdicts)        Merkle root                       ⛓️
 └─ telemetry.publish()                            tell the dashboard
```

Attacks (🛡️) are just scripts that call `sign()` and `verify()` with something evil in between: a fake signature, a hostile channel, a stolen key.

---

## Part 1: Settings you will tune (`qsentinel/config.py`)

| Setting | Default | Meaning |
|---|---|---|
| `ProtocolConfig.rounds_per_bit` (n) | 256 | Quantum coins per hash bit. More means safer, but slower |
| `ProtocolConfig.hash_bits` (L) | 256 | Bits of the message fingerprint (SHAKE-256) |
| `ProtocolConfig.tau` | 0.10 | Max mismatch fraction per block, **direct** verifier |
| `ProtocolConfig.tau_transfer` | 0.14 | Max mismatch fraction, **forwarded** verifier (the gap gives transferability) |
| `ProtocolConfig.symmetrise` | True | Verifiers shuffle key copies (anti-repudiation) |
| `DetectorConfig.qber_max` | 0.11 | D4: error rate above this means an attack |
| `DetectorConfig.expected_noise` | 0.02 | D4: the smallest "normal" error rate SPRT assumes |
| `DetectorConfig.attack_qber` | 0.25 | D4: the error rate SPRT treats as "attack" |
| `sprt_alpha`, `sprt_beta` | 1e-6 | SPRT false-alarm / missed-attack probabilities |
| `fingerprint_alpha` | 1e-4 | D4: significance level for "the fingerprint changed" |
| `fingerprint_min_effect` | 0.005 | D4: ignore changes smaller than 0.5% |
| `cusum_slack`, `cusum_threshold` | 0.005, 0.03 | D4: memory across verifications |
| `chsh_min` | 2.0 | D3: below this there is no entanglement left |
| `chsh_drop_z` | 4.0 | D3: warn if CHSH drops more than 4 standard errors below the baseline |
| `fidelity_min` | 0.90 | D3: warn below this pooled fidelity |
| `bell_test_pairs`, `bell_window` | 2000, 10 | D3: spare pairs per check; how many checks to pool |
| `commission_rounds`, `commission_pairs` | 30000, 4000 | Size of the one-time link measurement |
| `LedgerConfig.merkle_batch` | 8 | Anchor a Merkle root every 8 verdicts |

`FAST` is a small profile (n = 64, L = 32) used by tests and CI so they run in seconds.

---

## Part 2: 🔍 Detection (`qsentinel/detect/`)

### 2.1 `base.py`: the shared forms

**`Severity`** has three levels:
- `INFO`: nothing wrong
- `WARNING`: suspicious, but the signature is still accepted
- `CRITICAL`: **any critical alarm means REJECT**

**`DetectorResult`** is the form every alarm fills in:
| Field | Meaning |
|---|---|
| `detector` | "D1" … "D6" |
| `alert` | did this alarm go off? |
| `severity` | how bad |
| `statistic` / `threshold` | the measured number and its limit (the dashboard draws these as a gauge) |
| `detail` | a sentence a human can read |
| `extra` | every other number, for the proof certificate |

**`DetectionContext`** is everything an alarm is allowed to look at:
| Field | What it is |
|---|---|
| `signature` | what Alice (or the attacker) sent |
| `pubkey` | the verifier's copy of the quantum public key |
| `transcript` | the measurement results (from `qds.verify`) |
| `settings` | the table in Part 1 |
| `nonces`, `identities` | memory for D5 and D6 (see `registry.py`) |
| `bell`, `bell_pairs` | the spare-pair measurements for D3 |
| `monitor`, `link` | the channel memory for this signer→verifier link |
| `transferred` | True if this signature was forwarded (use the looser τ) |

Alarms **only read** the context. The engine writes the memory afterwards. This keeps each alarm a pure, testable rule.

### 2.2 `registry.py`: memory for D5 and D6

**`NonceRegistry`** remembers, *per verifier*:
- `seen`: (verifier, nonce) pairs already used
- `consumed_keys`: (verifier, key_id) pairs already used. Keys are one-time.
- `last_counter`: (signer, verifier) → the highest counter seen

`check(...)` returns a list of problems: nonce reused, key reused, counter not increasing. `commit(...)` records a signature *after* it was accepted.

*Why per verifier?* The same honest signature may be checked by Bob **and** Charlie (transferability). It must never be accepted twice by the **same** verifier.

**`IdentityRegistry`**:
- `key_owner`: key_id → signer. Who a key belongs to.
- `authorised_verifiers`: who may verify (RBAC).
- `honeypots`: decoy key_ids that are never used to sign.

### 2.3 `calibrate.py`: the maths of "how safe are we?"

A forger who guesses each coin is wrong with probability at least **q** (q = 1/3 for six-state). A block of n coins passes if it has at most `⌊τ·n⌋` mismatches.

| Function | Computes | Example (n = 256, τ = 0.10) |
|---|---|---|
| `kl_bernoulli(a, p)` | "distance" between error rates a and p (KL divergence) | KL(0.10‖1/3) = 0.1497 |
| `forgery_bound(n, τ, q)` | Chernoff upper bound: forger passes a block, `exp(−n·KL(τ‖q))` | **2.3 × 10⁻¹⁷** |
| `forgery_exact(n, τ, q)` | exact binomial probability `P[Bin(n,q) ≤ ⌊τn⌋]` | **9.7 × 10⁻¹⁹** |
| `honest_rejection_bound(n, τ, p)` | Chernoff: an honest block wrongly fails at noise p | 4.2 × 10⁻¹⁰ (p = 2%) |
| `honest_rejection_exact(n, τ, p)` | exact version | **2.1 × 10⁻¹¹** |
| `rounds_needed(target, τ, q)` | smallest n that reaches a target safety | 247 for 10⁻¹⁶ at τ = 0.10 |
| `tradeoff_table()` | the n-vs-τ table in `docs/protocol.md` | - |

The exact value is always smaller than (safer than) the Chernoff bound. We report both: Chernoff is the easy-to-explain guarantee, and the exact value is the true figure.

For a forwarded signature (τ = 0.14, limit 35): forgery exact 5.8 × 10⁻¹³, honest rejection 9.3 × 10⁻²⁰.

### 2.4 `sequential.py`: deciding early (SPRT)

**`bernoulli_sprt(seq, p0, p1, alpha, beta)`** reads the mismatches one at a time and keeps a running score (the log-likelihood ratio):
- Each **mismatch** adds `ln(p1/p0)` = **+2.526** (with p0 = 2%, p1 = 25%).
- Each **match** adds `ln((1−p1)/(1−p0))` = **−0.2675**.
- Score ≥ `ln((1−β)/α)` = **+13.8** means **"attack"**. Score ≤ **−13.8** means **"honest"**. The test stops at the first boundary crossed.
- Under intercept-resend (QBER 1/3) the score rises about 0.66 per round, so the **attack is called after ~21 rounds** instead of all 65,536.
- On an honest channel (QBER 2%) it falls about 0.21 per round, so it's called **honest after ~65 rounds**.

The guarantee (Wald): false alarms ≤ α and missed attacks ≤ β, here 10⁻⁶ each.

**`cusum(...)`** is a per-sequence helper that D4 does not use. The CUSUM that matters runs *across* verifications in `channel_monitor.py`. This helper can be deleted (its TODO is already done there).

### 2.5 `fingerprint.py`: which direction is Eve listening from?

An honest signature gives **zero** errors, so every error is channel damage. The **basis** an error shows up in reveals **which kind** of damage (Pauli error) hit the qubit:

```
errors in Z-basis rounds  come from X or Y flips:   r_Z = pX + pY
errors in X-basis rounds  come from Z or Y flips:   r_X = pZ + pY
errors in Y-basis rounds  come from X or Z flips:   r_Y = pX + pZ
```

| Function | What it does |
|---|---|
| `per_basis_counts(meas_bases, mismatches)` | For each basis, returns `(errors, total)`. `{0: (e_Z, t_Z), 1: (e_X, t_X), 2: (e_Y, t_Y)}` |
| `pauli_vector(counts)` | Solves the 3 equations above: `pX = (r_Z + r_Y − r_X)/2`, `pY = (r_Z + r_X − r_Y)/2`, `pZ = (r_X + r_Y − r_Z)/2`, clipped at 0. Returns `None` if a basis was never measured (two-basis mode). |
| `_g_2x2(e1, n1, e0, n0)` | G-test (likelihood ratio) for "is today's error rate in this basis the same as the baseline's?" Big G means different. |
| `_label(...)` | Turns the excess (today minus baseline) into words; see below. |
| `fingerprint(current, baseline, alpha, min_effect)` | The main function; see below. |

**`fingerprint()` step by step:**
1. `rates`: today's error rate per basis.
2. With no baseline yet, return "no commissioning baseline".
3. `g`: the sum of the three G statistics; `df` = number of bases compared.
4. `p`: the p-value from the chi-square distribution. A small p means the channel changed.
5. `excess_rates`, `excess_pauli`: how much worse than baseline, per basis and per Pauli.
6. `drift` = `p < alpha` **and** some basis got at least `min_effect` worse. (Requiring a real size of change avoids alarms from tiny but "significant" wobbles.)
7. `est_intercept_fraction` = `2 × sum(excess_pauli)`. An intercepting eavesdropper applies a Pauli error to half the qubits she touches, so doubling gives the fraction she touched.

**`_label()` rules:**
- The biggest excess below `min_effect` → **"nominal"**.
- One Pauli holds ≥ 75% of the excess → **"single-axis probe along Z/X/Y"**.
- The smallest is ≥ half the biggest → **"isotropic"**: random-basis intercept *or* extra noise. These can't be told apart by shape (Pauli twirling), only by size.
- Otherwise → **"mixed anisotropic"**.

**Worked example:** Eve measures 6% of qubits in the Z basis.
- X and Y rounds get 3% errors each; Z rounds get 0%.
- `pauli_vector` gives `pX = 0, pY = 0, pZ = 0.03`, which is single-axis along Z.
- Estimated fraction: `2 × 0.03 = 0.06`. Correct.
- By contrast, plain noise with 4% errors in every basis gives `pX = pY = pZ = 0.02`, which is isotropic.

### 2.6 `channel_monitor.py`: memory across signatures

| Piece | What it is |
|---|---|
| `link_id(signer, verifier)` | The name of a link, e.g. `"alice->bob"`. |
| `LinkBaseline` | The link's **frozen normal**: per-basis errors, QBER, Bell correlators, pairs used. `summary()` gives a JSON version for the ledger. |
| `LinkState` | The baseline plus live memory: `bell_window` (last 10 Bell checks), `cusum` (running total), `verifications`, `cusum_alarms`. |
| `ChannelMonitor.commission(...)` | Creates the baseline **once** for a link. |
| `windowed_correlators(link, current, pairs)` | Pools today's Bell results with the last 10, weighted by pairs, for a steadier CHSH/fidelity estimate. |
| `cusum_next(link, qber, slack)` | **Previews** the next CUSUM value without saving it: `max(0, cusum + (qber − baseline_qber) − slack)`. |
| `record(link, correlators, pairs, cusum_value, alarm)` | Saves one verification into memory. It resets CUSUM to 0 after an alarm, so alarms don't repeat forever. |
| `status()` | JSON for the `/links` API. |

**CUSUM explained:** each verification adds "how much worse than normal was it, minus 0.5% slack". Normal noise pulls it back to 0; a small attack held over time builds it up. When it passes 0.03, the channel alarm fires. Example: a 1.7% excess adds about 0.012 per verification, so the alarm fires after about 3 verifications.

**Why "frozen"?** If the baseline learned from live traffic, a patient attacker could raise her attack slowly and the "normal" would follow her (the boiling frog). Here the baseline is measured once, written to the ledger, and never updated.

### 2.7 The six alarms (`d1_…` to `d6_…`)
Each file has one function, `run(ctx) → DetectorResult`.

**D1, `d1_eigenstate.py`:** adds up all mismatches. Zero means "all outcomes deterministic". It's always INFO: noise legitimately causes a few errors, so D1 reports and D2/D4 decide.

**D2, `d2_forgery.py`** (fake signatures):
1. `tau` = 0.10, or 0.14 if forwarded. `limit = floor(tau × n)` = 25.
2. `bad` = the blocks with more than 25 mismatches.
3. Any bad block → **CRITICAL** (REJECT).
4. `extra` carries the tolerance, the failed blocks (first 32), both forgery odds and both honest-rejection odds. The honest-rejection odds use the link's baseline noise (at least 2%).

*Why per block?* A message swap changes only some hash bits, and only those blocks go bad. An average across all blocks would hide it.

**D3, `d3_entanglement.py`** (is the quantum link still entangled?):
- `_chsh(c)` = `√2 × (ZZ + XX)`. A perfect link gives 2.828; anything ≤ 2 is classical, meaning no security.
- `_fidelity(c)` = `(1 + XX − YY + ZZ)/4`. A perfect link gives 1.0.
- `_var_chsh(c, pairs)`: the statistical uncertainty of S, used to judge whether a drop is real.
- `run()`: three checks.
  1. **CRITICAL** if today's S ≤ 2.
  2. **WARNING** if S dropped more than 4 standard errors below the baseline (`z_drop`).
  3. **WARNING** if pooled fidelity < 0.90.

The spare pairs are never used for signing, so **a forger cannot affect D3**. Only someone on the channel can. The frontend uses exactly this to tell "forgery" apart from "eavesdropping".

**D4, `d4_channel.py`** (is someone listening?). Five tests on the transcript:
| Test | Severity if it fires | Catches |
|---|---|---|
| QBER > 11% | CRITICAL | loud eavesdropping |
| SPRT says "attack" | CRITICAL | the same, decided early |
| Fingerprint drift | WARNING | **stealth probes** under 11% |
| CUSUM > 0.03 | WARNING | small attacks sustained over time |
| BSM χ² p < 0.001 | WARNING | tampering at the signer's side only (no-signalling limits this test) |

`p0` for SPRT is the link's baseline QBER, floored at 2% and capped at half of 25%. `extra` includes `rounds_saved_by_sprt`, the full fingerprint, and the CUSUM value.

**D5, `d5_replay.py`:** asks `NonceRegistry.check` (nonce, one-time key, counter) and checks the timestamp is within 300 s. Any problem → CRITICAL.

**D6, `d6_identity.py`:**
- Honeypot key used → CRITICAL: "keystore compromised".
- Key never issued, or owned by someone else → impersonation.
- The verifier's copy is for a different key → mismatch.
- Verifier not authorised → RBAC violation.

*Honeypot insight:* a thief with the real private key makes a **physically valid** signature, so D2 passes. Only the honeypot catches it.

### 2.8 `engine.py`: runs the alarms, writes the proof
- `DETECTORS`: the six alarm modules, in order.
- `Verdict`: `decision`, `results`, `certificate`. `alerts` = results that fired at warning or critical. `result("D4")` finds one alarm.
- `evaluate(ctx)`:
  1. Run all six alarms.
  2. REJECT if any is CRITICAL, otherwise ACCEPT.
  3. On ACCEPT only, `nonces.commit(...)` marks the nonce and key as used.
  4. **If D2 did not fire,** save this verification into the channel monitor. A forger's mismatches say nothing about the channel, so we don't let forgeries pollute the channel's memory.
  5. Build the certificate.
- `_certificate(...)`: the decision, protocol settings, transcript summary, signature ids, link, both forgery odds, the fingerprint label, all alerts, `ai_in_trust_path: False`, and `transcript_hash` (SHA3-256 of the transcript, which ties the certificate to the ledger).

### 2.9 `validate.py`: checking the maths against the simulator
`monte_carlo_forgery(n, tau, blocks)` simulates a forger who stole one copy of each qubit and measured it in a random basis:
- If her basis happens to be right, her value is right.
- Otherwise her value is a coin flip.
- It runs this through the real Stim simulator and counts how many blocks pass.

Result at n = 16, τ = 0.1: **0.01358 measured vs 0.01370 exact, a 0.9% error.** Deliverable D5 needs less than 10%. CI runs this on every push.

---

## Part 3: 🛡️ Cybersecurity

### 3.1 `pqc/signer.py`: ML-DSA-65 signatures (FIPS 204)
- `MLDSASigner._load()` uses `liboqs` if installed (fast, constant-time), otherwise the pure-Python `dilithium-py` (fine for demos).
- `__init__` makes a new key pair unless one is given.
- `sign(message)` and `verify(message, signature, public_key)`.
- Sizes: public key **1952 bytes**, signature **3309 bytes**.
- Used by the ledger (signs every entry) and by the secure channel (signs the handshake).

### 3.2 `pqc/kem.py`: agreeing on a secret key, quantum-safely
**Idea:** use two locks at once. X25519 is well tested but quantum-breakable; ML-KEM-768 is quantum-safe but new. The result is safe if **either** holds.

| Function | Steps |
|---|---|
| `_mlkem()` | Picks liboqs, or the pure-Python `kyber-py`. Both expose `keygen`, `encaps`, `decaps`. |
| `keygen()` | Makes an X25519 key and an ML-KEM key. Public key = X25519 public (32 B) + ML-KEM public (1184 B) = **1216 B**. |
| `encapsulate(pk)` | Sender side. (1) Make a throwaway X25519 key and combine it with the receiver's X25519 key to get `ss_x`. (2) ML-KEM-encapsulate to the receiver's ML-KEM key to get `ss_pq` and `ct_pq`. (3) Ciphertext = throwaway public (32 B) + `ct_pq` (1088 B) = **1120 B**. (4) Secret = `_combine(...)`. |
| `decapsulate(kp, ct)` | Receiver side: redo both halves with the secret keys to get the same secret. |
| `_combine(ss_pq, ss_x, ct, pk)` | HKDF-SHA3-256 over both secrets, **bound to the ciphertext and public key**, so an attacker can't mix pieces from different sessions. |

### 3.3 `pqc/channel.py`: the secure tunnel between nodes
**Handshake (3 steps):**
1. `hello()`, run by the initiator (Alice's node): makes a fresh hybrid key pair and sends `public key + ML-DSA signature over it`.
2. `accept(hello)`, run by the responder (Bob's node): checks the signature against **Alice's pinned identity key**; a wrong key raises `ChannelError` (MITM stopped). It then encapsulates to get a secret and ciphertext, derives two keys with `_keys()` (one per direction), and replies `ciphertext + ML-DSA signature over (hello + ciphertext)`.
3. `finish(reply)`, run by the initiator: checks Bob's signature against **Bob's pinned identity key**, decapsulates, and derives the same two keys.

**Sending and receiving:**
- `seal(plaintext)`: takes the next sequence number, builds a nonce from it, and encrypts with ChaCha20-Poly1305. `_aad()` binds the **direction** (I2R/R2I) and the **sequence number**. Output = seq (8 B) + ciphertext.
- `open(record)`:
  1. The sequence number must be **higher** than the last one, so replays and reorders are rejected.
  2. Decrypt and check the tag. Failure means tampered or wrong key.
  3. Remember the sequence number.
- `connect(a_id, b_id)`: runs the whole handshake in one process (for tests and demos).

**Why it matters for the quantum part:** teleportation needs the signer's 2 correction bits per qubit. The simulator shows Eve's knowledge is a **coin flip (0.50)** without them and **0.67** with them. Sending the bits through this tunnel leaves a quantum-only eavesdropper with nothing, while her damage still trips D3/D4.

### 3.4 `attacks/library.py`: the practice hacker
**Shared pieces:**
- `Outcome`: what an attack returns: the verdict, a detail sentence, an optional `ok` (its own success rule), `tags` (e.g. "AUDIT"), and `metrics`.
- `AttackReport.passed`: uses `ok` if the attack set it. Otherwise it passes only if the decision matches what's expected **and** at least one expected alarm fired.
- `_seed(rng)`: derives reproducible seeds. The same campaign seed gives the same result bit for bit.
- `_setup(env)`: registers Alice as signer and Bob as verifier.
- `_forge(...)`: builds a fake `Signature` object.
- `_info_meter(...)`: re-runs the revealed block through the channel. For the qubits Eve touched, it measures her accuracy **with** the correction bits (`eve_outcomes XOR fix`, where the fix is m1 for Z, m0 for X, m0⊕m1 for Y), her accuracy **without** them, and the damage she caused.

**The attacks:**
| Function | What the attacker does | Should be caught by |
|---|---|---|
| `honest` | nothing (control) | - (ACCEPT) |
| `blind_forgery` | guesses every basis and value | D2 |
| `known_basis_partial_forgery` | knows `strength` of the key, guesses the rest | D2 |
| `intercept_resend` | measures `strength` of transit qubits and resends them | D3, D4 |
| `entangle_and_measure` | copies transit qubits into her own ancilla, measures later | D3, D4 |
| `stealth_probe` | listens in Z on a few qubits only (QBER stays low) | D4 fingerprint (success = D4 noticed) |
| `replay` | re-sends an accepted signature | D5 |
| `key_reuse_forgery` | reuses a spent key: copies matching blocks, guesses the rest | D5 (+ D2) |
| `mitm_message_swap` | keeps the signature, changes the message | D2 |
| `_repudiation` | Alice damages Charlie's copy (`strength` of positions) so that Bob accepts and Charlie rejects | success = no harmful split; unprotected → ledger audit flags it |
| `impersonation` | presents Alice's key as "mallory" | D6 |
| `unauthorised_verification` | an unregistered verifier tries to verify | D6 |
| `stolen_key_honeypot` | dumps the keystore and signs with an unused key (which is a honeypot) | D6 |

- `AttackSpec` / `ATTACKS`: the table of name → (function, expected decision, expected alarms, default strength).
- `run_attack(env, name, strength, seed, channel)`: runs one attack and wraps the result in an `AttackReport`.

### 3.5 `attacks/run.py` and `attacks/sweep.py`
- `run.py`: reads a YAML campaign (`campaigns/smoke.yaml`: 17 runs, small profile; `full.yaml`: full size). It builds a fresh system for each run, prints PASS/FAIL, and **exits 1 if anything fails**, which breaks CI.
- `sweep.py`: for each strength from `--min` to `--max`, runs `--trials` attacks. It reports the reject rate, alert rate, pass rate, mean QBER and each alarm's firing rate, and can save a CSV. Strength 0 of a channel attack is the honest channel, so that row is the **false-alarm rate**.

### 3.6 `api/main.py`: who is allowed to do what
- `Principal`: a user name and roles.
- `_key_table()`: reads `QSENTINEL_API_KEYS="key=name:role+role,..."` from the environment.
- `_lookup(key)`: with no keys configured, **dev mode** (everyone is admin). Otherwise it compares keys with `hmac.compare_digest` (constant-time, no timing leaks); an unknown key gets 401.
- `require(*roles)`: a FastAPI dependency. Admin passes everything; otherwise you need one of the roles, or get 403.
- `_acting_as(p, requested)`: **your identity comes from your key**. A signer can only sign as themselves, and a verifier can only verify as themselves (except admin).
- The WebSocket takes `?key=` and requires analyst or admin.

---

## Part 4: ⛓️ Blockchain

### 4.1 `ledger/hashchain.py`: the diary nobody can edit
- `_h(obj)`: SHA3-256 of canonical JSON (sorted keys), so the same data always gives the same hash.
- `LedgerEntry` fields:
  - `index`
  - `timestamp`
  - `kind`
  - `prev_hash`: this is the "chain"
  - `payload_hash`
  - `payload`
  - `entry_hash`
  - `signature`: ML-DSA over `entry_hash`
- `HashChainLedger.__init__(signer, path)`: in-memory, or reloads from a `.jsonl` file.
- `append(kind, payload)`:
  1. Take the previous entry's hash (or 64 zeros for the first entry).
  2. Hash the payload.
  3. `entry_hash` = hash of (index, prev, payload_hash, timestamp, kind).
  4. Sign it with ML-DSA.
  5. Save it, and append to the file if there is one.

  A lock makes this safe with many threads.
- `unanchored_verdicts()`: verdict entries after the last Merkle anchor.
- `anchor(batch, force)`: if at least `batch` verdicts are waiting (or `force`), compute their Merkle root and append a `merkle_anchor` entry `{root, first, last, members}`.
- `inclusion_proof(index)`: finds the anchor containing this verdict and returns `{leaf, root, anchor_index, proof}`, or `None` if not anchored yet.
- `check_proof(proof)`: verifies a proof.
- `verify_chain()`: for every entry, checks that the link to the previous entry holds, the payload hash matches, the header hash matches, and the ML-DSA signature is valid. **One changed byte anywhere breaks it.**
- `by_kind(kind)`: filter helper.

**Entry kinds:**
| Kind | Written by | Contains |
|---|---|---|
| `verdict` | `pipeline.verify` | the decision, transcript hash, who, key, nonce, counter, transferred, link |
| `merkle_anchor` | `ledger.anchor` | the root over the last batch of verdicts |
| `link_commissioned` | `pipeline.commission_link` | the frozen baseline |
| `sym_commit` | `pipeline.symmetrise_key` | each verifier's commitment |
| `sym_reveal` | `pipeline.reveal_symmetrisation` | each verifier's share and salt |

### 4.2 `ledger/merkle.py`: short proofs
- `_leaf(data)` = SHA3(`0x00` + data); `_node(l, r)` = SHA3(`0x01` + l + r). The two tags stop a join being passed off as a leaf.
- `_split(n)`: the largest power of 2 below n. The tree splits there (RFC 6962, same as Certificate Transparency), so any number of leaves works.
- `_mth(leaves)`: builds the tree recursively and returns the root. `merkle_root()` gives it as hex.
- `inclusion_proof(i, leaves)`: walking down to leaf i, records the **other half's** hash and its side (L/R) at each level. 8 leaves → 3 hashes.
- `verify_inclusion(leaf, proof, root)`: starts from the leaf hash and combines it with each sibling on the stated side. If it matches the root, the leaf is in the batch.

### 4.3 `ledger/commit_reveal.py`: locking in a choice before revealing it
- `commitment(key_id, party, share, salt)` = SHA3(`tag | key_id | party | salt | share`). It hides the share (thanks to the random salt) but locks it in.
- `verify_reveal(...)`: recomputes the commitment and compares (constant-time).
- `joint_seed(key_id, shares)`: hashes **all** shares, in sorted party order, into one number. No single verifier controls it.

### 4.4 `qds/symmetrise.py`: shuffling the key copies
`symmetrise(handles, seed)`:
1. Stack every verifier's copy into one array.
2. For **every coin position**, randomly permute which verifier gets which copy (`argsort` of random numbers along the verifier axis).
3. Return new handles.

If Alice damaged Charlie's copy, the damage is now spread evenly across Bob and Charlie.

### 4.5 How the pipeline uses them (`pipeline.py`)
- `symmetrise_key(key_id)`: each verifier makes a secret share and salt → one `sym_commit` entry with all commitments → `joint_seed` → `symmetrise` → store the shuffled copies. This all happens **before** Alice signs.
- `reveal_symmetrisation(key_id)`: posts the shares and salts in a `sym_reveal` entry, so anyone can re-check.
- `verify(...)`: after the verdict, `ledger.append("verdict")`, then `ledger.anchor(batch = 8)`, then put the Merkle proof (or "pending") into the certificate.
- `__post_init__`: if the ledger already has entries (a restart), rebuild the replay memory from it.

### 4.6 `ledger/audit.py`: anyone can check the diary
- `rebuild_freshness(ledger)`: replays every ACCEPTed verdict into a new `NonceRegistry`. Replay protection survives restarts.
- `check_anchors(ledger)`: recomputes every Merkle root and reports any mismatch.
- `find_disputes(ledger)`: groups verdicts by (key_id, nonce). "Leniency" is 0 for direct and 1 for forwarded. A **dispute** exists when someone ACCEPTed and someone **at least as lenient** REJECTed.
  - That's the harmful split: either Alice equivocated (tried to set up a denial) or a verifier lied.
  - "Strict Bob rejects, lenient Charlie accepts" is **not** a dispute; the threshold gap is designed to allow it.
- `check_symmetrisation(ledger)`: every reveal must match its commitment; lists keys never revealed.
- `audit(ledger)`: everything above, in one report (`GET /ledger/audit`).

---

## Part 5: The quantum pieces this code relies on

`quantum/stim_backend.py`:
- **Eve action codes per round:** 0–2 = intercept-resend in Z/X/Y; 3 = none; 4–6 = ancilla probe in Z/X/Y.
- `_channel()`: adds noise; then, for intercept, measures and resends; for a probe, rotates to Eve's basis, CNOTs into ancilla qubit 3, and rotates back.
- `RoundResult` now also returns `eve_bases` and `eve_outcomes` (−1 where Eve did nothing). These are used only by the info meter, never by the alarms.
- `ChannelModel.honest_part()`: the channel minus the attack, used for commissioning.

---

## Part 6: Which test checks what

| Test file | Proves |
|---|---|
| `test_detectors.py` | every attack is caught by its alarm; honest noisy signatures raise no false alarms; stolen-key signatures are physically valid but caught; CUSUM alarms on repeated stealth probes; the baseline never changes |
| `test_fingerprint.py` | each probe axis is recovered exactly; noise is isotropic; a stealth probe is flagged with the right size; the random-basis blind spot is documented |
| `test_calibrate.py` | the dossier's 10⁻¹⁶ figure; exact ≤ Chernoff; the simulator matches the formula within 10%; SPRT decides within 40 rounds |
| `test_pqc.py` | the KEM agrees; the channel works both ways; tamper, replay, reflection and MITM are rejected |
| `test_ledger.py` | tampering is detected; Merkle proofs work for 1–17 leaves; anchoring through the pipeline; replay protection survives a restart; commit-reveal; disputes found without symmetrisation, none with it |
| `test_api.py` | sign→verify→replay; attack endpoint; public Merkle proof; RBAC (401/403, can't act as someone else) |
| `test_no_ml_in_trust_path.py` | no AI library is imported by or loaded into the trust kernel |

Run them all with `pytest`. Run the attack campaign with `python -m qsentinel.attacks.run`.

---

## Part 7: How to change common things

- **Make it stricter or looser:** change `tau` / `tau_transfer` in `config.py`, then run `python -m qsentinel.detect.validate` and the campaign.
- **Add a new alarm rule:** add a check inside the relevant `dN_*.py` `run()`, give it a severity, and add a test. **No ML imports** (CI will fail).
- **Add a new attack:**
  1. Write `def my_attack(env, strength, rng, channel) -> Outcome` in `library.py`.
  2. Add it to `ATTACKS` with the expected decision and alarms.
  3. Add it to `campaigns/smoke.yaml`.
- **Add a new ledger record type:** call `env.ledger.append("my_kind", {...})`. It's automatically chained, signed and verified. If it's a verdict-like record, extend `audit.py`.
- **Swap in real post-quantum crypto:** `pip install -e .[pqc]` (liboqs). `signer.py` and `kem.py` pick it up automatically.

## Glossary
| Term | Meaning |
|---|---|
| QBER | the fraction of coins that came out wrong (quantum bit error rate) |
| Basis (Z/X/Y) | the "direction" a quantum coin is prepared and measured in |
| Pauli error (X/Y/Z) | the three ways a qubit can be flipped |
| CHSH S | an entanglement score: ≤ 2 classical, 2.83 perfect |
| SPRT | a test that decides as soon as the evidence is strong enough |
| CUSUM | a running total that catches small, persistent problems |
| G-test | a likelihood-ratio test for "did the error rate change?" |
| Nonce | a random number used once, which makes every signature unique |
| Merkle root | one hash that summarises many entries; each entry is provable with a few hashes |
| Commit-reveal | lock in a hidden choice first, reveal it later; can't be changed in between |
| Symmetrisation | verifiers shuffle their key copies so a cheating signer can't treat them differently |
| KEM | key encapsulation mechanism: how two computers agree on a secret key |
| AEAD | encryption that also detects tampering (here ChaCha20-Poly1305) |
