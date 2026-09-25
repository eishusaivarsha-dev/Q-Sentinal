"""Q-SENTINEL: AI-free, quantum-inspired threat detection for teleportation-based QDS.

Layer map (see docs/architecture.md):
    L0  qsentinel.quantum   - quantum substrate (Stim / Qiskit / IBM backends)
    L1  qsentinel.qds       - QDS protocol engine (KeyGen, Sign, Verify)
    L2  qsentinel.detect    - trust kernel: detectors D1-D6 (NO AI/ML, enforced by CI)
    L3  qsentinel.ledger    - hash-chained, ML-DSA-signed non-repudiation ledger
        qsentinel.pqc       - post-quantum classical crypto
    L4  qsentinel.attacks   - attack simulation harness
    L5  ops/ (separate package) + web/ - operations plane, advisory only
"""

__version__ = "0.1.0"
