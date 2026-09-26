"""Optional Qiskit/Aer backend smoke test.

Run this after installing the quantum extras. It exits successfully with a
clear skip message when Qiskit is unavailable.
"""
from __future__ import annotations

import numpy as np

from qsentinel.quantum.states import state_for_label

try:
    from qsentinel.quantum.backends import QiskitAerBackend
except Exception as exc:  # pragma: no cover
    print(f"Qiskit/Aer unavailable: {exc}")
    raise SystemExit(0)

backend = QiskitAerBackend(shots=4096, seed_simulator=2026)
counts = backend.bsm_counts(4096)
state = state_for_label("+i")
result = backend.teleport(state, rng=np.random.default_rng(2026))
print("Qiskit/Aer BSM counts:", counts)
print("Reference/Aer hybrid teleport fidelity:", result.fidelity)
assert min(counts.values()) > 0
assert result.fidelity >= 0.99
print("Qiskit/Aer smoke test: PASS")
