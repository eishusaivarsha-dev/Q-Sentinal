# D1-D6 Acceptance Checklist

This file is the human-facing checklist for demonstrating the quantum/detection workstream.

| Deliverable | Demonstration | Evidence produced |
|---|---|---|
| D1 | Run `python examples/acceptance_checks.py` and open `docs/protocol/qds_protocol.pdf` | formal specification + numerical re-derivation values |
| D2 | Run `pytest -q` and, with Qiskit installed, `python examples/check_qiskit.py` | teleportation fidelity + BSM chi-square result |
| D3 | Acceptance script | 10,000/10,000 honest signatures |
| D4 | Acceptance script | six detector fixtures, all mapped detections |
| D5 | Acceptance script / notebook | 100,000-trial FAR validation + confidence interval |
| D6 | Acceptance script | seven attacks + deterministic repeatability |

The generated report lives in `artifacts/d1_d6_acceptance_report.md` and `artifacts/d1_d6_acceptance_report.json`.
