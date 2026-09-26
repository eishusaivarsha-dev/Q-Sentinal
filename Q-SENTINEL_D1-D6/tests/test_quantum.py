import numpy as np

from qsentinel.quantum.states import state_for_label, measure_projectively
from qsentinel.quantum.bell import phi_plus, bell_fidelity
from qsentinel.quantum.teleportation import teleport, build_teleportation_circuit
from qsentinel.quantum.corrections import correction_from_bits
from qsentinel.quantum.bsm import sample_bsm
from qsentinel.quantum.backends import IdealBackend, NoisyBackend


def test_pauli_eigenstates_normalized():
    for label in ("0", "1", "+", "-", "+i", "-i"):
        state = state_for_label(label)
        assert np.isclose(np.linalg.norm(state), 1.0)


def test_phi_plus_fidelity_is_one():
    assert np.isclose(bell_fidelity(phi_plus()), 1.0)


def test_correction_table():
    assert [correction_from_bits(x) for x in ("00", "01", "10", "11")] == ["I", "X", "Z", "XZ"]


def test_teleportation_ideal_has_unit_fidelity():
    rng = np.random.default_rng(7)
    state = state_for_label("+i")
    result = teleport(state, rng=rng)
    assert result.fidelity > 1 - 1e-12


def test_bsm_has_four_outcomes():
    counts = sample_bsm(4000, rng=np.random.default_rng(7))
    assert all(counts[key] > 0 for key in ("00", "01", "10", "11"))
    assert sum(counts.values()) == 4000


def test_backend_contracts():
    backend = IdealBackend()
    result = backend.teleport(state_for_label("-"), rng=np.random.default_rng(1))
    assert result.fidelity >= 0.99
    noisy = NoisyBackend(depolarizing_probability=0.0)
    assert noisy.teleport(state_for_label("-i"), rng=np.random.default_rng(1)).fidelity >= 0.99


def test_qiskit_circuit_builder_is_optional():
    try:
        circuit = build_teleportation_circuit(state_for_label("+"))
    except ImportError:
        return
    assert circuit.num_qubits == 3
    assert circuit.num_clbits == 2
