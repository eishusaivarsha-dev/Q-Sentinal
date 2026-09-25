"""Qiskit Aer backend - cross-validation of the Stim engine (optional extra: pip install -e .[qiskit]).

Uses Aer's stabilizer method so large batched circuits stay tractable. Honest channel noise
is applied as random Pauli insertions (same model as Stim's DEPOLARIZE1).

`bell_correlators` (D3 input) was contributed by Shubham Kumar. It mirrors the Stim backend's
template batching: every pair is one of a few tiny circuits (setting x channel noise x Eve
action), each run once with shots = number of pairs of that type.

TODO(quantum-lead): add Aer density-matrix mode with amplitude damping (non-Pauli noise).
"""

from __future__ import annotations

import numpy as np

from .backend import ChannelModel, RoundResult
from .stim_backend import N_ACTIONS, NO_EVE, _eve_choices


def _require_qiskit():
    try:
        from qiskit import ClassicalRegister, QuantumCircuit, QuantumRegister
        from qiskit_aer import AerSimulator
    except ImportError as e:  # pragma: no cover
        raise ImportError("Qiskit backend needs: pip install -e .[qiskit]") from e
    return QuantumCircuit, QuantumRegister, ClassicalRegister, AerSimulator


def _prep(qc, q, basis: int, value: int) -> None:
    if basis == 0:
        if value:
            qc.x(q)
    else:
        qc.h(q)
        if basis == 2:
            qc.s(q)
        if value:
            qc.z(q)


def _to_z(qc, q, basis: int) -> None:
    if basis == 1:
        qc.h(q)
    elif basis == 2:
        qc.sdg(q)
        qc.h(q)


def _from_z(qc, q, basis: int) -> None:
    if basis == 1:
        qc.h(q)
    elif basis == 2:
        qc.h(q)
        qc.s(q)


def _channel(qc, q, channel: ChannelModel, rng, eve_creg, eve_i: list[int]) -> bool:
    if channel.depolarizing > 0 and rng.random() < channel.depolarizing:
        getattr(qc, ("x", "y", "z")[rng.integers(3)])(q)
    if rng.random() < channel.intercept_fraction:
        b = int(rng.choice(channel.eve_bases))
        _to_z(qc, q, b)
        qc.measure(q, eve_creg[eve_i[0]])
        _from_z(qc, q, b)
        eve_i[0] += 1
        return True
    return False


def _bell_template(QuantumCircuit, setting: int, pauli: int, eve: int):
    """One Bell pair measured in `setting`, with one channel-noise Pauli and one Eve action.

    q0 = signer's half, q1 = verifier's half (the one in transit), q2 = Eve's ancilla (probe only).
    `pauli` 0 = none, 1/2/3 = X/Y/Z inserted on q1. `eve` uses the Stim backend's action codes
    (0-2 intercept-resend in basis Z/X/Y, 3 none, 4-6 ancilla probe in basis Z/X/Y).
    Classical bits: [eve outcome (intercept only)] a b. Returns (circuit, offset of `a`).
    """
    intercept, probe = eve < NO_EVE, eve > NO_EVE
    qc = QuantumCircuit(3 if probe else 2, 3 if intercept else 2)
    qc.h(0)
    qc.cx(0, 1)
    if pauli:
        getattr(qc, ("x", "y", "z")[pauli - 1])(1)
    off = 0
    if intercept:                        # Eve measures, then re-sends in the original basis
        _to_z(qc, 1, eve)
        qc.measure(1, 0)
        _from_z(qc, 1, eve)
        off = 1
    elif probe:                          # Eve copies the basis-b value of q1 into her ancilla
        _to_z(qc, 1, eve - 4)
        qc.cx(1, 2)
        _from_z(qc, 1, eve - 4)
    _to_z(qc, 0, setting)
    qc.measure(0, off)
    _to_z(qc, 1, setting)
    qc.measure(1, off + 1)
    return qc, off


class QiskitAerBackend:
    name = "qiskit"

    def teleport_and_measure(self, prep_bases, prep_values, meas_bases,
                             channel: ChannelModel, seed: int) -> RoundResult:
        QuantumCircuit, QuantumRegister, ClassicalRegister, AerSimulator = _require_qiskit()
        n = len(prep_bases)
        rng = np.random.default_rng(seed)
        qr = QuantumRegister(3 * n, "q")
        eve, m0, m1, out = (ClassicalRegister(n, "eve"), ClassicalRegister(n, "m0"),
                            ClassicalRegister(n, "m1"), ClassicalRegister(n, "out"))
        qc = QuantumCircuit(qr, eve, m0, m1, out)
        attacked = np.zeros(n, dtype=bool)
        eve_i = [0]
        for i in range(n):
            a, b, c = qr[3 * i], qr[3 * i + 1], qr[3 * i + 2]
            _prep(qc, a, int(prep_bases[i]), int(prep_values[i]))
            qc.h(b)
            qc.cx(b, c)
            attacked[i] = _channel(qc, c, channel, rng, eve, eve_i)
            qc.cx(a, b)
            qc.h(a)
            qc.cx(b, c)
            qc.cz(a, c)
            qc.measure(a, m0[i])
            qc.measure(b, m1[i])
            _to_z(qc, c, int(meas_bases[i]))
            qc.measure(c, out[i])
        sim = AerSimulator(method="stabilizer", seed_simulator=seed)
        mem = sim.run(qc, shots=1, memory=True).result().get_memory()[0]
        # Memory string: registers in reverse order, bits within a register reversed.
        regs = {name: bits[::-1] for name, bits in zip(("out", "m1", "m0", "eve"), mem.split(), strict=False)}

        def bits(name):
            return np.array([int(x) for x in regs[name][:n]], dtype=np.uint8)

        return RoundResult(outcomes=bits("out"),
                           bsm=np.column_stack([bits("m0"), bits("m1")]), attacked=attacked)

    def bell_correlators(self, n_pairs: int, channel: ChannelModel, seed: int) -> dict[str, float]:
        """Sacrificial Bell pairs -> <ZZ>, <XX>, <YY>, same contract as `StimBackend`.

        Each pair estimates one correlator (its setting is drawn uniformly), and the attack
        schedule comes from the same sampler as the Stim backend, so for a given seed both
        backends attack the same pairs and only the quantum simulation differs. Reproducible
        for a fixed seed on the same Qiskit Aer version.
        """
        QuantumCircuit, _, _, AerSimulator = _require_qiskit()
        rng = np.random.default_rng(seed)
        eve = _eve_choices(n_pairs, channel, rng)
        setting = rng.integers(0, 3, size=n_pairs)
        pauli = np.zeros(n_pairs, dtype=np.int64)        # honest channel noise: random X/Y/Z
        if channel.depolarizing > 0:
            hit = rng.random(n_pairs) < channel.depolarizing
            pauli[hit] = rng.integers(1, 4, size=int(hit.sum()))

        sim = AerSimulator(method="stabilizer")
        parity = np.zeros(n_pairs, dtype=np.int8)
        key = (setting * N_ACTIONS + eve) * 4 + pauli
        for k in np.unique(key):
            rows = np.flatnonzero(key == k)
            rest, p = divmod(int(k), 4)
            s, e = divmod(rest, N_ACTIONS)
            qc, off = _bell_template(QuantumCircuit, s, p, e)
            job = sim.run(qc, shots=int(rows.size), memory=True,
                          seed_simulator=int(rng.integers(2**31 - 1)))
            # Aer memory strings list the highest-indexed classical bit first.
            bits = np.array([[int(c) for c in m[::-1]] for m in job.result().get_memory()], dtype=np.uint8)
            parity[rows] = 1 - 2 * (bits[:, off] ^ bits[:, off + 1])   # +1 if outcomes agree
        return {name: float(parity[setting == s].mean()) if (setting == s).any() else 0.0
                for s, name in ((0, "ZZ"), (1, "XX"), (2, "YY"))}
