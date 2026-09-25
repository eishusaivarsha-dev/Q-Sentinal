# Roadmap: what gets built when, and with which tools

| Phase | When | Build | Tools introduced |
|---|---|---|---|
| **P0 Foundation** | Weeks 1–4 | Protocol spec + proofs (docs/protocol.md), this skeleton, CI green | Python, Stim, Qiskit, NumPy/SciPy, pytest, GitHub Actions |
| **P1 Grand Finale** | 36 h | sign → attack → detect → dashboard demo | FastAPI, React/Vite/Tailwind, Recharts, Three.js, dilithium-py/liboqs, Docker Compose |
| **P2 Hardening** | Months 1–3 | All 7 attacks, calibration notebook, security report, benchmarks | QuTiP, Numba, statsmodels, Hypothesis, Jupyter |
| **P3 Trust layer** | Months 4–6 | Fabric/Besu ledger, symmetrisation, post-quantum TLS, RBAC, 50 verifiers | Hyperledger Fabric (Go), IPFS, OpenSSL 3.5, Vault/SoftHSM, OAuth 2.1, Redis, Postgres/Timescale |
| **P4 Intelligence & reality** | Months 7–9 | AI ops plane (advisory), IBM hardware validation | scikit-learn, LLM, Prophet, Optuna, IBM Quantum Runtime |
| **P5 Deployment** | Months 10–12 | SIEM connectors, standards mapping, pilot, paper | STIX 2.1, Elastic/Splunk, Kubernetes/Helm, Prometheus/Grafana, MkDocs |

## 36-hour finale cut (must work first)
1. Six-state QDS on Stim, plus D2, D4, D5 and D6 *(already working in this repo)*
2. Attacks: forgery, intercept-resend, replay and MITM *(already working)*
3. Dashboard with the attack slider and the proof certificate *(starter working)*
4. ML-DSA hash-chain ledger *(already working)*
5. Nice to have: live D3 chart, Fabric, a recorded IBM hardware run
