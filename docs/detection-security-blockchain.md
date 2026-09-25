# Detection, cybersecurity and blockchain: how it works and how to run it

## Try it

```bash
python -m qsentinel.attacks.run                                   # 17 attacks, all must pass
python -m qsentinel.attacks.run qsentinel/attacks/campaigns/full.yaml
python -m qsentinel.attacks.sweep stealth_probe --max 0.08 --noise 0.03 --full --out stealth.csv
python -m qsentinel.attacks.sweep repudiation --full --min 0.1 --max 0.4 --steps 7
python -m qsentinel.detect.validate --n 16 --blocks 40000         # bound vs simulator
```

---

## 1. Detection (`qsentinel/detect/`)

### Link commissioning and the frozen baseline (`channel_monitor.py`)
The first time a signer→verifier link is used, it is **commissioned**: 30,000 test rounds whose states are revealed immediately, plus 4,000 Bell pairs.
- Every mismatch in this phase is pure channel noise. The per-basis error rates, the QBER and the Bell correlators become the link's **baseline**.
- The baseline is written to the ledger (`link_commissioned`).
- Live traffic **never** updates the baseline. An adaptive baseline could be dragged off slowly by a patient attacker (the "boiling frog"). Re-commissioning is an explicit, logged action.

### D4 Pauli fingerprint (`fingerprint.py`)
An honest signature is deterministic, so every mismatch is a channel error, and the *basis* it shows up in identifies the Pauli error behind it:

| Measured basis | Flipped by | Equation |
|---|---|---|
| Z | X, Y | r_Z = pX + pY |
| X | Z, Y | r_X = pZ + pY |
| Y | X, Z | r_Y = pX + pZ |

Solving these gives the channel's Pauli vector. A G-test compares each verification to the baseline.
- **Single-axis excess** means an eavesdropper is measuring in that basis. The fingerprint names the axis.
- **Estimated intercepted fraction** ≈ 2 × Σ(excess Pauli). A true 3% probe was estimated as 3.1%.
- **Known blind spot:** a uniformly random-basis attacker looks exactly like depolarising noise (Pauli twirling). She is caught by *magnitude* (QBER, SPRT, CUSUM), not by *shape*. A test documents this.

Sweep result (test profile, 3% honest noise): a single verification notices a 4% probe about half the time, and a ≥ 6% probe every time, with 0 false alarms at 0%. At full size (n=256), a 3% probe is caught at QBER 1.0%. Smaller probes across many verifications are what CUSUM is for.

### D4 CUSUM and D3 rolling window
- **CUSUM** accumulates per-verification QBER excess over the baseline. It raises a channel alarm for a small attack that is sustained over time.
- **D3** pools CHSH correlators over the last 10 checks. It warns when S drops more than 4σ below the commissioning baseline, and goes CRITICAL when S ≤ 2.

### D2 exact bounds (`calibrate.py`, `validate.py`)
Every certificate carries both the Chernoff bound and the **exact** binomial probability. `validate.py` runs a real "measure-a-copy" forger through the Stim simulator: the empirical pass rate was 0.01358 against 0.01370 exact, a 0.9% error.

### D5 one-time keys, per verifier
The nonce, one-time key and counter are tracked **per verifier**, because the same signature may legitimately be verified by several verifiers. Reusing a consumed key is flagged (`key_reuse_forgery`).

### D6 honeypot keys
Decoy keys are distributed exactly like real ones but never signed with. A thief who dumps the keystore produces a **physically valid** signature (D2 passes). Only the honeypot catches it, and it has zero false positives.

---

## 2. Cybersecurity (`qsentinel/attacks/`, `qsentinel/pqc/`, `qsentinel/api/`)

### Attack library (17 in the campaign)
honest ×2, blind forgery, partial-key forgery, intercept-resend (100% / 50%), **entangle-and-measure**, **stealth probe** ×2, replay, **key-reuse forgery**, MITM message swap, **repudiation** (with and without symmetrisation), impersonation, unauthorised verification, **stolen keystore → honeypot**.

### Information-vs-disturbance meter
For intercept and entangle attacks, the report shows what Eve learned against what she broke:

| | Eve's accuracy on key values | Disturbance |
|---|---|---|
| Correction bits readable | 0.67 | 0.33 |
| Correction bits encrypted | **0.50 (coin flip, zero information)** | 0.33 |

Teleportation acts as a quantum one-time pad keyed by the signer's two Bell-measurement bits. **Carry those bits over `SecureChannel` and a quantum-only eavesdropper learns nothing, but still leaves her disturbance for D3/D4.**

### Post-quantum channel (`pqc/kem.py`, `pqc/channel.py`)
- **Key agreement:** hybrid X25519 + ML-KEM-768, combined with HKDF-SHA3-256 and bound to both ciphertexts and public keys.
- **Authentication:** an ML-DSA-65 signed handshake against pinned identities, so a MITM fails.
- **Records:** ChaCha20-Poly1305 with strictly increasing sequence numbers. This rejects tampering, replay, reordering and reflection.

### API access control
Set `QSENTINEL_API_KEYS="k1=alice:signer,k2=bob:verifier,k3=soc:analyst,k4=root:admin"`.
- Roles: signer, verifier, analyst, redteam, admin.
- **Identity comes from the key, not from the request body.** Alice can only sign as Alice, and Bob can only verify as Bob.
- With the variable unset, the API runs in open dev mode.

---

## 3. Blockchain (`qsentinel/ledger/`)

| Piece | File | What it gives you |
|---|---|---|
| Hash chain + ML-DSA-65 | `hashchain.py` | Tamper-evident, quantum-safe log |
| Merkle anchoring | `merkle.py` | One root per 8 verdicts; O(log n) inclusion proofs; `GET /ledger/proof/{i}` is public |
| Commit-reveal | `commit_reveal.py` | Verifiers fix random shares before any signature exists |
| Symmetrisation | `qds/symmetrise.py` | Verifiers' public-key copies shuffled by the joint seed |
| Auditor | `audit.py` | Rebuilds replay state, checks anchors, checks reveals, finds disputes |

### Repudiation and transferability
A dishonest signer sends different quantum states to Bob and to Charlie, so Bob accepts and a forwarded Charlie rejects. She can then deny the signature.

The defence has two parts:
- **Symmetrisation.** The verifiers commit random shares on-chain, derive a joint seed, and shuffle their copies position by position. Any tampering is then spread evenly across all verifiers.
- **Two thresholds.** τ = 0.10 for the direct recipient and τ_transfer = 0.14 for a forwarded one.

The only harmful split is "strict verifier ACCEPTS, lenient verifier REJECTS". The auditor flags exactly that case.

| Tampering δ | Unprotected: Alice splits the verifiers | Symmetrised: transferability holds |
|---|---|---|
| 0.1 | no | 100% |
| 0.2 | **yes, every trial (all flagged by audit)** | 100% |
| 0.3 | **yes (all flagged)** | 100% |
| 0.4 | **yes (all flagged)** | 100% |

(Full size, n=256.) At the small test profile (n=64) the τ gap is only 2 mismatches, which is why production uses n=256.
