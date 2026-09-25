"""Qiskit Aer backend - cross-validation of the Stim engine (optional extra: pip install -e .[qiskit]).

Uses Aer's stabilizer method so large batched circuits stay tractable. Honest channel noise
is applied as random Pauli insertions (same model as Stim's DEPOLARIZE1).

TODO(quantum-lead): add Aer density-matrix mode with amplitude damping (non-Pauli noise).
"""

from __future__ import annotations

import numpy as np

from .backend import ChannelModel, RoundResult


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
        raise NotImplementedError("TODO(quantum-lead): port StimBackend.bell_correlators to Aer")
