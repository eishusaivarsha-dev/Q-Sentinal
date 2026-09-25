"""Direct CHSH test with rotated measurement settings (optional extra: pip install -e .[qiskit]).

Author: Shubham Kumar.

D3 normally derives the CHSH value from stabilizer correlators, S = sqrt(2) * (<ZZ> + <XX>),
which is exact for the |Phi+> pair under the Pauli channels we model. This module measures S
the way a Bell experiment does: each pair is measured at one of the four canonical settings
(a = 0, a' = 90 deg, b = 45 deg, b' = 135 deg in the X-Z plane) and

    S = E(a, b) - E(a, b') + E(a', b) + E(a', b').

The 45-degree settings are non-Clifford, so Stim cannot run this; it uses Qiskit Aer's
statevector method. Its purpose is an independent cross-check of the D3 input, not a
replacement for it. Channel noise and the attack schedule use the same model and sampler
as the other backends, so for a given seed the same pairs are attacked.

    python -m qsentinel.quantum.chsh_direct            # honest vs intercept-resend
"""

from __future__ import annotations

import math

import numpy as np

from .backend import ChannelModel
from .qiskit_backend import _from_z, _require_qiskit, _to_z
from .stim_backend import N_ACTIONS, NO_EVE, _eve_choices

# (alice angle, bob angle) per setting, and the sign each correlator takes in S.
SETTINGS = ((0.0, math.pi / 4), (0.0, 3 * math.pi / 4),
            (math.pi / 2, math.pi / 4), (math.pi / 2, 3 * math.pi / 4))
SIGNS = (1, -1, 1, 1)
CLASSICAL_BOUND = 2.0
TSIRELSON_BOUND = 2 * math.sqrt(2)


def _template(QuantumCircuit, setting: int, pauli: int, eve: int):
    """One Bell pair: channel Pauli + Eve action on the verifier's half, then rotated measurement.

    q0 = signer's half, q1 = verifier's half, q2 = Eve's ancilla (probe only).
    Eve action codes match the Stim backend (0-2 intercept-resend Z/X/Y, 3 none, 4-6 probe Z/X/Y).
    Classical bits: 0 = signer, 1 = verifier, 2 = Eve (intercept only).
    """
    intercept, probe = eve < NO_EVE, eve > NO_EVE
    qc = QuantumCircuit(3 if probe else 2, 3 if intercept else 2)
    qc.h(0)
    qc.cx(0, 1)
    if pauli:
        getattr(qc, ("x", "y", "z")[pauli - 1])(1)
    if intercept:
        _to_z(qc, 1, eve)
        qc.measure(1, 2)
        _from_z(qc, 1, eve)
    elif probe:
        _to_z(qc, 1, eve - 4)
        qc.cx(1, 2)
        _from_z(qc, 1, eve - 4)
    alice, bob = SETTINGS[setting]
    qc.ry(-alice, 0)
    qc.ry(-bob, 1)
    qc.measure(0, 0)
    qc.measure(1, 1)
    return qc


def chsh_direct(n_pairs: int, channel: ChannelModel = ChannelModel(), seed: int = 0) -> dict:
    """Estimate S from `n_pairs` Bell pairs, each measured at one uniformly drawn setting.

    Returns S, the four correlators, pair counts per setting, and both bounds.
    Reproducible for a fixed seed on the same Qiskit Aer version.
    """
    QuantumCircuit, _, _, AerSimulator = _require_qiskit()
    rng = np.random.default_rng(seed)
    eve = _eve_choices(n_pairs, channel, rng)
    setting = rng.integers(0, 4, size=n_pairs)
    pauli = np.zeros(n_pairs, dtype=np.int64)          # honest noise: random X/Y/Z (Stim DEPOLARIZE1)
    if channel.depolarizing > 0:
        hit = rng.random(n_pairs) < channel.depolarizing
        pauli[hit] = rng.integers(1, 4, size=int(hit.sum()))

    sim = AerSimulator(method="statevector")
    product = np.zeros(n_pairs, dtype=np.int8)
    key = (setting * N_ACTIONS + eve) * 4 + pauli
    for k in np.unique(key):
        rows = np.flatnonzero(key == k)
        rest, p = divmod(int(k), 4)
        s, e = divmod(rest, N_ACTIONS)
        job = sim.run(_template(QuantumCircuit, s, p, e), shots=int(rows.size), memory=True,
                      seed_simulator=int(rng.integers(2**31 - 1)))
        # Aer memory strings list the highest-indexed classical bit first.
        bits = np.array([[int(c) for c in m[::-1]] for m in job.result().get_memory()], dtype=np.uint8)
        product[rows] = 1 - 2 * (bits[:, 0] ^ bits[:, 1])   # +1 if outcomes agree

    names = ("E(a,b)", "E(a,b')", "E(a',b)", "E(a',b')")
    corr = {name: float(product[setting == s].mean()) if (setting == s).any() else 0.0
            for s, name in enumerate(names)}
    s_value = sum(sign * corr[name] for sign, name in zip(SIGNS, names, strict=True))
    return {
        "S": s_value,
        "correlators": corr,
        "pairs_per_setting": {name: int((setting == s).sum()) for s, name in enumerate(names)},
        "classical_bound": CLASSICAL_BOUND,
        "tsirelson_bound": TSIRELSON_BOUND,
    }


if __name__ == "__main__":  # pragma: no cover
    for label, ch in (("honest", ChannelModel()), ("intercept-resend", ChannelModel(intercept_fraction=1.0))):
        r = chsh_direct(8000, ch, seed=1)
        print(f"{label:17} S = {r['S']:.3f}  (classical {CLASSICAL_BOUND}, Tsirelson {TSIRELSON_BOUND:.3f})")
