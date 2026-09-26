# Architecture / Integration Notes

```text
L0 Quantum substrate
  Bell pairs | Pauli eigenstates | BSM | teleportation | simulator backend
          |
L1 QDS protocol engine
  KeyGen | public-key distribution | Sign | Verify
          |
L2 Quantum-inspired threat detection core
  D1 Eigenstate | D2 Forgery | D3 Entanglement | D4 Channel
  D5 Replay | D6 Identity
          |
L4 Attack/evaluation harness (D6)
  seven seeded attack classes
          |
External team components
  backend API | blockchain/PQC | frontend/SOC
```

The detector package is intentionally AI-free. Operations-plane analytics can
consume the detector result dictionaries downstream without being able to
change an accept/reject decision.
