# Architecture

```
 L5  Operations plane      web/ (SOC dashboard) + ops/ (AI, advisory only)
          ▲  one-way, read-only telemetry (qsentinel/telemetry.py → Redis Streams later)
 L4  Attack harness        qsentinel/attacks/        seeded, reproducible red team
 L3  Trust layer           qsentinel/ledger/ + pqc/  ML-DSA-signed hash chain → Fabric (P3)
 L2  Detection core        qsentinel/detect/         D1–D6, closed-form, AI-FREE
 L1  QDS engine            qsentinel/qds/            KeyGen · distribute · Sign · Verify
 L0  Quantum substrate     qsentinel/quantum/        Stim │ Qiskit Aer │ IBM hardware
```

## Request flow (one verification)

1. `pipeline.QSentinel.sign()` issues a **fresh one-time key**, teleports the public key to every authorised verifier, and signs the message by revealing one key block per digest bit.
2. `qds.verify()` measures the public-key block selected by `SHAKE-256(message‖nonce)`, in the revealed bases, through a `QuantumBackend` and a `ChannelModel`. It returns a transcript and makes **no decision**.
3. `detect.evaluate()` runs D1–D6 and returns ACCEPT/REJECT along with a **proof certificate**.
4. The verdict's transcript hash is appended to the ledger (signed with ML-DSA).
5. A telemetry event is published, and the dashboard and ops plane read it.

## The invariant

Data flows **up** only. Nothing in L5 can call or modify L0–L2. This is enforced by:
- `lint-imports`: import contracts in `pyproject.toml`
- `tests/test_no_ml_in_trust_path.py`: a static AST scan plus a runtime `sys.modules` check
- `deploy/Dockerfile.api`: the kernel image fails to build if an ML library is present
- `ops/`: a separate package that never imports `qsentinel` and talks only over HTTP

## Detectors

| ID | Watches | Rule | Catches |
|---|---|---|---|
| D1 | determinism | mismatches == 0 (info) | baseline integrity |
| D2 | per-block mismatches | any block > ⌊τn⌋ (τ_transfer if forwarded) | forgery, MITM message swap, key reuse |
| D3 | CHSH S, fidelity F (sacrificial pairs) | S ≤ 2 critical; S drop vs baseline or pooled F < 0.9 warning | entanglement tampering |
| D4 | QBER, SPRT, **Pauli fingerprint**, **CUSUM**, χ² on BSM | QBER > 11% or SPRT critical; fingerprint drift / CUSUM warning | intercept-resend, entangle-and-measure, **stealth probes** |
| D5 | nonce, one-time key, counter, timestamp (per verifier) | reused / non-monotonic / stale | replay, key reuse |
| D6 | key↔signer, key↔verifier, RBAC, **honeypots** | any binding mismatch / honeypot used | impersonation, unauthorised verification, **stolen keystore** |
| Audit | ledger (`ledger/audit.py`) | strict ACCEPT vs lenient REJECT on the same signature | **repudiation / equivocation** |

Detection, cybersecurity and blockchain details: [detection-security-blockchain.md](detection-security-blockchain.md).
