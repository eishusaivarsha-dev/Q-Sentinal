"""Exact state-vector teleportation engine (D2 reference). OWNER: Quantum Lead.

Ported from Anansh Jain's D1-D6 workstream (quantum/states.py, bell.py, bsm.py, corrections.py,
teleportation.py) and made exact: instead of drawing the BSM bits and applying the matching Pauli
by hand, this module evolves the full 3-qubit density matrix through the real protocol:

    |psi>_0 (x) |Phi+>_12  ->  channel on qubit 2 (the verifier's half in transit)
                           ->  Bell-state measurement on (0, 1)  ->  Pauli fix Z^m0 X^m1 on qubit 2

The channel is the same `ChannelModel` the Stim backend uses (honest depolarising noise, then an
eavesdropper who intercept-resends or entangles-and-measures a fraction of pairs), so the two
engines can be cross-checked: for the six Pauli eigenstates, 1 - fidelity here equals the error
rate Stim measures (tests/test_statevector.py).

Stim samples 65k rounds in milliseconds; this engine explains ONE round exactly (Bloch vectors,
BSM probabilities, the correction). The dashboard's Teleportation Lab draws it in 3-D.
No ML, pure NumPy/SciPy: it is part of the trust kernel's substrate.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from scipy.stats import chisquare

from .backend import ChannelModel

I2 = np.eye(2, dtype=complex)
X = np.array([[0, 1], [1, 0]], dtype=complex)
Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
Z = np.array([[1, 0], [0, -1]], dtype=complex)
H = np.array([[1, 1], [1, -1]], dtype=complex) / math.sqrt(2)
PAULIS = (X, Y, Z)

_S2 = 1 / math.sqrt(2)
EIGENSTATES: dict[str, np.ndarray] = {
    "0": np.array([1, 0], dtype=complex),
    "1": np.array([0, 1], dtype=complex),
    "+": np.array([_S2, _S2], dtype=complex),
    "-": np.array([_S2, -_S2], dtype=complex),
    "+i": np.array([_S2, 1j * _S2], dtype=complex),
    "-i": np.array([_S2, -1j * _S2], dtype=complex),
}
LABEL_OF = {(0, 0): "0", (0, 1): "1", (1, 0): "+", (1, 1): "-", (2, 0): "+i", (2, 1): "-i"}
BASIS_OF = {label: b for (b, _), label in LABEL_OF.items()}
BSM_KEYS = ("00", "01", "10", "11")
# Correction for BSM bits (m0, m1) = Z^m0 X^m1, the same deferred form the Stim backend uses.
CORRECTION_NAME = {"00": "I", "01": "X", "10": "Z", "11": "XZ"}


def state_from_bloch(theta: float, phi: float) -> np.ndarray:
    """cos(theta/2)|0> + e^{i phi} sin(theta/2)|1>."""
    return np.array([math.cos(theta / 2), np.exp(1j * phi) * math.sin(theta / 2)], dtype=complex)


def eigenstate(basis: int, value: int) -> np.ndarray:
    return EIGENSTATES[LABEL_OF[(int(basis), int(value))]].copy()


def bloch(rho: np.ndarray) -> tuple[float, float, float]:
    """Bloch vector (<X>, <Y>, <Z>) of a one-qubit density matrix."""
    return tuple(float(np.real(np.trace(rho @ p))) for p in PAULIS)  # type: ignore[return-value]


def _projectors(basis: int) -> tuple[np.ndarray, np.ndarray]:
    return tuple(np.outer(v, v.conj()) for v in (eigenstate(basis, 0), eigenstate(basis, 1)))  # type: ignore


def _on_qubit(op: np.ndarray, q: int) -> np.ndarray:
    """Embed a one-qubit operator on qubit q of three (qubit 0 is the most significant)."""
    mats = [I2, I2, I2]
    mats[q] = op
    return np.kron(np.kron(mats[0], mats[1]), mats[2])


def _cnot(control: int, target: int) -> np.ndarray:
    p0, p1 = np.diag([1, 0]).astype(complex), np.diag([0, 1]).astype(complex)
    mats0, mats1 = [I2, I2, I2], [I2, I2, I2]
    mats0[control], mats1[control], mats1[target] = p0, p1, X
    k = lambda m: np.kron(np.kron(m[0], m[1]), m[2])  # noqa: E731
    return k(mats0) + k(mats1)


def measurement_channel(rho: np.ndarray, q: int, basis: int) -> np.ndarray:
    """Measure qubit q in `basis` and forget the result (what an eavesdropper leaves behind)."""
    return sum(_on_qubit(p, q) @ rho @ _on_qubit(p, q) for p in _projectors(basis))


def apply_channel(rho: np.ndarray, q: int, ch: ChannelModel) -> np.ndarray:
    """The Stim backend's channel, as an exact average: depolarise, then Eve (if she acts)."""
    if ch.depolarizing > 0:
        p = ch.depolarizing
        rho = (1 - p) * rho + (p / 3) * sum(_on_qubit(s, q) @ rho @ _on_qubit(s, q) for s in PAULIS)
    fi, fe = ch.intercept_fraction, ch.entangle_fraction
    if fi > 0 or fe > 0:
        out = (1 - fi - fe) * rho
        if fi > 0:
            out = out + fi * sum(measurement_channel(rho, q, b) for b in ch.eve_bases) / len(ch.eve_bases)
        if fe > 0:
            out = out + fe * measurement_channel(rho, q, ch.entangle_basis)
        rho = out
    return rho


def _verifier_state(rho: np.ndarray) -> np.ndarray:
    """Partial trace over qubits 0 and 1."""
    return np.einsum("abcabd->cd", rho.reshape([2] * 6))


@dataclass(frozen=True)
class TeleportTrace:
    input_bloch: tuple[float, float, float]
    bsm_probabilities: dict[str, float]    # exactly 1/4 each for ANY input and ANY local channel
    bsm: str                               # the sampled outcome "m0m1"
    correction: str                        # I, X, Z or XZ
    received_bloch: tuple[float, float, float]   # verifier's qubit before the Pauli fix
    output_bloch: tuple[float, float, float]     # after the fix
    fidelity: float                        # <psi| rho_out |psi>
    error_rate: float                      # 1 - fidelity: P[a test along psi's own axis fails]
    basis: int | None                      # the input's own basis when it is a Pauli eigenstate

    def to_dict(self) -> dict:
        return self.__dict__.copy()


def teleport(psi: np.ndarray, channel: ChannelModel = ChannelModel(), rng: np.random.Generator | None = None,
             basis: int | None = None) -> TeleportTrace:
    """One exact teleportation round of |psi> through `channel`."""
    psi = np.asarray(psi, dtype=complex)
    psi = psi / np.linalg.norm(psi)
    rng = rng or np.random.default_rng()
    phi_plus = np.array([1, 0, 0, 1], dtype=complex) / math.sqrt(2)
    state = np.kron(psi, phi_plus)
    rho = apply_channel(np.outer(state, state.conj()), 2, channel)
    u = _on_qubit(H, 0) @ _cnot(0, 1)                        # Bell basis -> computational basis
    rho = u @ rho @ u.conj().T
    probs, bob = {}, {}
    for m0 in (0, 1):
        for m1 in (0, 1):
            key = f"{m0}{m1}"
            proj = _on_qubit(np.diag([1 - m0, m0]).astype(complex), 0) @ _on_qubit(
                np.diag([1 - m1, m1]).astype(complex), 1)
            branch = proj @ rho @ proj
            p = float(np.real(np.trace(branch)))
            probs[key] = p
            bob[key] = _verifier_state(branch) / p if p > 1e-15 else np.zeros((2, 2), complex)
    keys = list(BSM_KEYS)
    pv = np.array([probs[k] for k in keys])
    key = keys[int(rng.choice(4, p=pv / pv.sum()))]
    received = bob[key]
    fix = np.linalg.matrix_power(Z, int(key[0])) @ np.linalg.matrix_power(X, int(key[1]))
    out = fix @ received @ fix.conj().T
    fidelity = float(np.real(psi.conj() @ out @ psi))
    return TeleportTrace(bloch(np.outer(psi, psi.conj())), {k: round(v, 12) for k, v in probs.items()}, key,
                         CORRECTION_NAME[key], bloch(received), bloch(out), fidelity, 1 - fidelity,
                         _eigen_basis(psi) if basis is None else basis)


def _eigen_basis(psi: np.ndarray) -> int | None:
    for (b, _), label in LABEL_OF.items():
        if abs(abs(np.vdot(EIGENSTATES[label], psi)) - 1) < 1e-9:
            return b
    return None


def six_state_error_rate(channel: ChannelModel) -> float:
    """Average error over the six Pauli eigenstates: the QBER the Stim backend should measure."""
    return float(np.mean([teleport(EIGENSTATES[lab], channel, np.random.default_rng(0)).error_rate
                          for lab in EIGENSTATES]))


def bsm_counts(shots: int, channel: ChannelModel = ChannelModel(), seed: int | None = None,
               psi: np.ndarray | None = None) -> dict:
    """Sample `shots` BSM outcomes from the exact probabilities + a chi-square uniformity test.

    Ported from Anansh's statistics/chi_square.py: a biased BSM (p < 1e-3) would mean the
    resource state is not a Bell pair, which detector D4 also watches.
    """
    if shots <= 0:
        raise ValueError("shots must be positive")
    rng = np.random.default_rng(seed)
    psi = EIGENSTATES["0"] if psi is None else psi
    probs = teleport(psi, channel, rng).bsm_probabilities
    counts = rng.multinomial(shots, [probs[k] for k in BSM_KEYS])
    stat, p_value = chisquare(counts, f_exp=np.full(4, shots / 4))
    return {"shots": shots, "counts": dict(zip(BSM_KEYS, map(int, counts), strict=True)),
            "chi2": float(stat), "p_value": float(p_value), "uniform": bool(p_value > 1e-3)}


def qasm(theta: float = 0.0, phi: float = 0.0) -> str:
    """OpenQASM 2 for the teleportation circuit (runs on Qiskit / IBM hardware as-is)."""
    return "\n".join([
        "OPENQASM 2.0;", 'include "qelib1.inc";', "qreg q[3];", "creg m[2];", "creg out[1];",
        f"u3({theta:.6f},{phi:.6f},0) q[0];      // signer's qubit |psi>",
        "h q[1];", "cx q[1],q[2];               // Bell pair |Phi+> shared with the verifier",
        "cx q[0],q[1];", "h q[0];                    // Bell-state measurement",
        "measure q[0] -> m[0];", "measure q[1] -> m[1];",
        "if(m==2) x q[2];            // Pauli fix X^m1 (m[1] set)", "if(m==3) x q[2];",
        "if(m==1) z q[2];            // Pauli fix Z^m0 (m[0] set)", "if(m==3) z q[2];",
        "measure q[2] -> out[0];",
    ])
