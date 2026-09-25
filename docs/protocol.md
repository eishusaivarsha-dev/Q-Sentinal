# Protocol specification (working draft, deliverable D1)

## 1. Encoding
Six-state (default): Z {|0⟩,|1⟩}, X {|+⟩,|−⟩}, Y {|+i⟩,|−i⟩}. Two-basis (BB84-style) is available through `ProtocolConfig(basis_set="two-basis")`.

## 2. Keys (one-time)
The private key is a CSPRNG seed expanded to `(L, 2, n)` (basis, value) pairs: L digest bits, 2 candidate blocks per bit, and n rounds per block. **Each key signs exactly one message.** Revealing a block burns it, and `KeyAlreadyUsedError` enforces this.

## 3. Public-key distribution (teleportation)
For each eigenstate: the signer and verifier share |Φ⁺⟩. The signer performs a Bell-state measurement and sends 2 bits (m0, m1), and the verifier applies X^m1 Z^m0. In simulation this uses the deferred-measurement form (CX, CZ), which also avoids dynamic circuits on hardware.

## 4. Signing (Lamport-style message binding)
h = SHAKE-256(message ‖ nonce) truncated to L bits. The signature reveals block `(i, h_i)` for every i, along with the nonce, a monotonic counter and a timestamp. Changing the message changes the digest, which selects blocks the attacker can't know, so D2 fires. This closes the gap where a revealed signature could be attached to a different message.

## 5. Verification
The verifier measures block `(i, h_i)` in the revealed bases. An honest signature gives every outcome equal to its revealed value, deterministically, so FRR = 0 on a noiseless channel.

## 6. Security bounds and the noise trade-off
An uninformed forger mismatches each round with probability ≥ q, where q = 1/4 (two-basis) or 1/3 (six-state). With per-block threshold τ (Chernoff/KL):

  P[forger passes a block] ≤ exp(−n · KL(τ ‖ q))  P[honest block rejected] ≤ exp(−n · KL(τ ‖ p_noise))

n needed for a forgery probability ≤ 10⁻¹⁶ per block (`qsentinel.detect.calibrate.tradeoff_table()`):

| τ (noise tolerance) | two-basis | six-state |
|---|---|---|
| 0 % | 129 | 91 |
| 5 % | 256 | 153 |
| 10 % | 509 | **247** |
| 15 % | 1238 | 425 |

**Default: six-state, n = 256, τ = 0.10.** At a real-world QBER of 2–3%, honest rejection is below 10⁻¹². The dossier's headline "(3/4)¹²⁸ = 1.02×10⁻¹⁶" is the τ = 0 (noiseless) row.

## 7. Detector notes and honest caveats
- **χ² on BSM outcomes** only detects tampering at the source or on the signer's side. By no-signalling, intercept-resend on the verifier's leg can't change the signer's BSM statistics, so that attack is caught by QBER/SPRT (D4) and CHSH (D3).
- **CHSH** needs sacrificial pairs, and the error on S is about 4/√N. Treat it as a channel-level monitor, not a per-signature one. With optimal settings, S = √2(⟨ZZ⟩+⟨XX⟩), which only needs Clifford measurements.
- **Transferability / repudiation:** ledger consensus records verdicts, but it can't stop a signer sending *different* quantum states to different verifiers. The planned fix is symmetrisation: verifiers exchange random subsets of their outcomes through **on-chain commit-reveal**. This is TODO (Blockchain + Quantum).
- **Quantum memory:** the current mode assumes the verifier stores the teleported qubits. The hardware-realistic mode measures on receipt (Dunjko, Wallden & Andersson). This is TODO (Quantum).
- **Fabric** consensus uses ECDSA. Payload-level ML-DSA signatures keep the records quantum-safe until a custom MSP exists.

## References
Gottesman & Chuang (quant-ph/0105032); Dunjko, Wallden & Andersson (arXiv:1403.5551); Yin, Fu & Chen (arXiv:1507.03333); Bennett et al., PRL 70, 1895 (1993); CHSH, PRL 23, 880 (1969); NIST FIPS 203/204/205; Gidney, *Stim* (Quantum 5, 497, 2021).
