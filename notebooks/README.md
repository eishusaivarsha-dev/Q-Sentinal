# notebooks/

Jupyter notebooks for the security report (D7) and benchmarks (D8). Planned:

| Notebook | Owner | Shows |
|---|---|---|
| `01_calibration.ipynb` | Detection | Empirical vs Chernoff forgery/FRR rates over 10⁵ trials |
| `02_detection_vs_strength.ipynb` | Security | Detection rate vs adversary strength, per attack |
| `03_benchmarks.ipynb` | Team Lead | Latency/throughput vs n and verifier count; RSA-3072 / ECDSA-P256 baselines |
| `04_ibm_hardware.ipynb` | Quantum | Teleportation fidelity + QBER floor on a real device |

Save raw hardware job results under `notebooks/hardware_runs/` so nobody spends QPU minutes twice.
