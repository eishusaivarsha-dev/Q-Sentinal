import numpy as np
import pytest

qiskit_aer = pytest.importorskip("qiskit_aer")

from qsentinel.quantum.backends import QiskitAerBackend
from qsentinel.quantum.states import state_for_label
from qsentinel.statistics.chi_square import chi_square_uniformity


def test_real_aer_bsm_uniformity_and_teleport_smoke():
    backend = QiskitAerBackend(shots=4096, seed_simulator=2026)
    counts = backend.bsm_counts(4096)
    chi = chi_square_uniformity(counts)
    assert chi["p_value"] > 0.05
    result = backend.teleport(state_for_label("+i"), rng=np.random.default_rng(2026))
    assert result.fidelity >= 0.99
