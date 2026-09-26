# Q-SENTINEL — D1 to D6 Quantum / Detection Workstream

This repository is the complete **D1–D6 implementation** for the Q-SENTINEL SIH 2026 quantum and quantum-inspired detection workstream.

## Deliverables

- **D1 — Mathematical Model & Protocol Specification**: formal Pauli-state alphabet, Bell resource, teleportation correction map, verification predicate, basis-guessing forgery bounds, Hoeffding/Chernoff bounds, CHSH/fidelity observables and detector mapping.
- **D2 — Quantum Substrate & Teleportation Engine**: Pauli eigenstates, Bell states, BSM, Pauli correction, NumPy reference backend, noisy backend model and optional Qiskit Aer circuit backend.
- **D3 — QDS Protocol Engine**: deterministic seed-based KeyGen, teleportation-based public-key material, Sign, projective Verify, binding/provenance/freshness checks and typed results.
- **D4 — Quantum-Inspired Threat Detection Core**: six independent, AI-free detectors.
- **D5 — Statistical Threshold Calibration**: Hoeffding, Chernoff/KL, $\\chi^2$, CUSUM, Wald SPRT, conservative threshold derivation and 100,000-trial FAR validation.
- **D6 — Attack Simulation Harness**: seven parameterized attacks, YAML campaign configs, deterministic seeds and bit-for-bit reproducibility checks.

## Repository layout

```text
qsentinel/
  quantum/       # D2
  qds/           # D3
  detect/        # D4
  statistics/    # D5
  attacks/       # D6

docs/protocol/   # D1 LaTeX + PDF
configs/attacks/ # D6 YAML campaigns
examples/        # demos + complete acceptance check
artifacts/       # generated acceptance report
notebooks/       # D5 calibration notebook
tests/           # unit + acceptance tests
```

## Setup

```bash
python -m venv .venv
# Linux / WSL
source .venv/bin/activate
# Windows PowerShell
# .venv\\Scripts\\Activate.ps1

pip install -r requirements.txt
```

The Qiskit/Aer versions are pinned to the tested compatibility line in the
project requirements. IBM's current Aer documentation lists `qiskit-aer 0.17.2`
as supporting Qiskit 2.5.0.

## Test everything

```bash
pytest -q
```

## Run the complete D1–D6 acceptance report

```bash
python examples/acceptance_checks.py
```

The script checks:

- D1 specification exists and contains the protocol/bound sections.
- D2 ideal teleportation fidelity is at least 0.99 and BSM uniformity passes $\\chi^2$ with $p>0.05$.
- D3 accepts **10,000 / 10,000** honest signatures (FRR = 0 in the noiseless model).
- D4 has unit fixtures for all six detectors.
- D5 runs a reproducible **100,000-trial** Monte-Carlo FAR check and reports the exact finite-sample operating probability separately from the conservative Hoeffding upper bound.
- D6 runs all seven attacks and verifies bit-for-bit reproducibility from the same seed.
- The AI-free trust-path guard passes.

Outputs:

```text
artifacts/d1_d6_acceptance_report.json
artifacts/d1_d6_acceptance_report.md
```

## Qiskit/Aer smoke test

```bash
python examples/check_qiskit.py
```

The code also exposes a Qiskit circuit builder for the standard teleportation
protocol, including classical-feedforward Pauli corrections.

## End-to-end attack demo

```bash
python examples/run_demo.py
```

The resulting flow is:

```text
KeyGen
  -> teleportation-based public-key distribution
  -> Sign
  -> Verify
  -> attack simulation
  -> projective measurements
  -> six deterministic detectors
  -> alert report
```

## D4 detector names

```text
D1  Eigenstate Verifier
D2  Forgery Estimator
D3  Entanglement Integrity Monitor
D4  Channel Anomaly Detector
D5  Replay & Freshness Guard
D6  Identity Binding Monitor
```

## Security boundary

This is a **simulation-first research prototype**, not a claim of a completed
composable QDS security proof or production deployment. The D1 specification
states its explicit assumptions. Real IBM hardware validation, authenticated
classical-channel deployment, permissioned blockchain/PQC integration and the
SOC frontend belong to the later system layers owned by the other team members.
