"""Stim stabilizer backend - the default engine.

Every operation in the protocol (Bell pairs, Pauli eigenstates, CNOT/H/CZ, Pauli
measurements) is Clifford, so a stabilizer simulator is exact.

Speed trick: rounds are independent and each round is one of at most 72 small circuit
"templates" (prep basis x prep value x measurement basis x eavesdropper action). We compile
each template once (3 qubits) and draw `shots = number of rounds of that type`, so cost is
linear in n and a 65k-round verification takes well under a second.

Per-round qubits: q0 = signer's eigenstate, q1 = signer's half of |Phi+>, q2 = verifier's half.
Pauli corrections use the deferred-measurement form (CX q1->q2, CZ q0->q2), which is also
what we run on hardware without dynamic circuits.

Note: results are reproducible for a fixed seed on the same Stim version + CPU architecture.
"""

from __future__ import annotations

from functools import lru_cache

import numpy as np
import stim

from .backend import ChannelModel, RoundResult

_RESET = {0: "R", 1: "RX", 2: "RY"}
_TO_Z = {0: None, 1: "H", 2: "H_YZ"}  # rotation mapping basis b onto Z (self-inverse)
NO_EVE = 3


def _measure(c: stim.Circuit, q: int, basis: int, restore: bool = False) -> None:
    gate = _TO_Z[basis]
    if gate:
        c.append(gate, [q])
    c.append("M", [q])
    if restore and gate:  # Eve re-sends the collapsed state in its original basis
        c.append(gate, [q])


def _channel(c: stim.Circuit, q: int, depolarizing: float, eve_basis: int) -> None:
    if depolarizing > 0:
        c.append("DEPOLARIZE1", [q], depolarizing)
    if eve_basis != NO_EVE:
        _measure(c, q, eve_basis, restore=True)


@lru_cache(maxsize=4096)
def _round_sampler_circuit(pb: int, pv: int, mb: int, depolarizing: float, eve: int) -> stim.Circuit:
    """Record order: [eve] m0 m1 out."""
    c = stim.Circuit()
    c.append(_RESET[pb], [0])                         # signer prepares Pauli eigenstate
    if pv:
        c.append("X" if pb == 0 else "Z", [0])        # flip to the -1 eigenstate
    c.append("H", [1])                                # Bell pair |Phi+> on (1, 2)
    c.append("CX", [1, 2])
    _channel(c, 2, depolarizing, eve)                 # verifier's half in transit
    c.append("CX", [0, 1])                            # Bell-state measurement ...
    c.append("H", [0])
    c.append("CX", [1, 2])                            # ... + deferred Pauli correction X^m1
    c.append("CZ", [0, 2])                            #                              Z^m0
    c.append("M", [0, 1])
    _measure(c, 2, mb)                                # verifier measures revealed basis
    return c


@lru_cache(maxsize=256)
def _bell_circuit(setting: int, depolarizing: float, eve: int) -> stim.Circuit:
    """Record order: [eve] a b."""
    c = stim.Circuit()
    c.append("H", [0])
    c.append("CX", [0, 1])
    _channel(c, 1, depolarizing, eve)
    _measure(c, 0, setting)
    _measure(c, 1, setting)
    return c


def _eve_choices(n: int, channel: ChannelModel, rng: np.random.Generator) -> np.ndarray:
    attacked = rng.random(n) < channel.intercept_fraction
    eve = rng.choice(np.array(channel.eve_bases), size=n)
    return np.where(attacked, eve, NO_EVE).astype(np.int64)


class StimBackend:
    name = "stim"

    def teleport_and_measure(self, prep_bases, prep_values, meas_bases,
                             channel: ChannelModel, seed: int) -> RoundResult:
        pb = np.asarray(prep_bases, dtype=np.int64)
        pv = np.asarray(prep_values, dtype=np.int64)
        mb = np.asarray(meas_bases, dtype=np.int64)
        n = pb.size
        rng = np.random.default_rng(seed)
        eve = _eve_choices(n, channel, rng)

        outcomes = np.zeros(n, dtype=np.uint8)
        bsm = np.zeros((n, 2), dtype=np.uint8)
        key = ((pb * 2 + pv) * 3 + mb) * 4 + eve
        for k in np.unique(key):
            rows = np.flatnonzero(key == k)
            e, rest = int(k % 4), int(k // 4)
            m, rest = rest % 3, rest // 3
            v, b = rest % 2, rest // 2
            circuit = _round_sampler_circuit(b, v, m, channel.depolarizing, e)
            shots = circuit.compile_sampler(seed=int(rng.integers(2**63))).sample(rows.size)
            off = 0 if e == NO_EVE else 1
            bsm[rows] = shots[:, off:off + 2]
            outcomes[rows] = shots[:, off + 2]
        return RoundResult(outcomes=outcomes, bsm=bsm, attacked=eve != NO_EVE)

    def bell_correlators(self, n_pairs: int, channel: ChannelModel, seed: int) -> dict[str, float]:
        rng = np.random.default_rng(seed)
        eve = _eve_choices(n_pairs, channel, rng)
        setting = rng.integers(0, 3, size=n_pairs)   # which correlator each pair estimates
        parity = np.zeros(n_pairs, dtype=np.int8)
        key = setting * 4 + eve
        for k in np.unique(key):
            rows = np.flatnonzero(key == k)
            s, e = int(k // 4), int(k % 4)
            shots = _bell_circuit(s, channel.depolarizing, e).compile_sampler(
                seed=int(rng.integers(2**63))).sample(rows.size)
            off = 0 if e == NO_EVE else 1
            parity[rows] = 1 - 2 * (shots[:, off] ^ shots[:, off + 1])  # +1 if outcomes agree
        return {name: float(parity[setting == s].mean()) if (setting == s).any() else 0.0
                for s, name in ((0, "ZZ"), (1, "XX"), (2, "YY"))}
