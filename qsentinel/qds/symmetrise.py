"""Symmetrisation: verifiers shuffle their copies of a quantum public key (anti-repudiation).

Threat: a dishonest signer sends DIFFERENT states to different verifiers, so Bob accepts and
Charlie rejects the same signature. The signer can later deny it ("Charlie says it's invalid").
That breaks non-repudiation and transferability.

Defence: after distribution, and before any signature exists, the verifiers exchange a
random subset of their public-key positions. For every position, the copies are permuted
among the verifiers by a permutation the signer cannot predict. Any corruption the signer put
in one verifier's copy is then spread evenly across all verifiers, so their mismatch counts
follow the same distribution. Combined with the threshold gap tau < tau_transfer, "Bob accepts
but Charlie rejects" becomes exponentially unlikely.

The permutation seed comes from a commit-reveal between the verifiers, anchored on the ledger
(qsentinel/ledger/commit_reveal.py). No single verifier controls it, the signer never sees it
in time, and an arbiter can recompute it later.

Physical note: in quantum-memory mode the swap is a verifier-to-verifier teleportation of the
selected qubits. In measure-on-receipt mode it is an exchange of classical outcomes.
The simulator does not model the extra noise of that second hop.
"""

from __future__ import annotations

import numpy as np

from .keys import PublicKeyHandle


def symmetrise(handles: list[PublicKeyHandle], seed: int) -> list[PublicKeyHandle]:
    """Return new handles whose states are a per-position random permutation of all copies."""
    if len(handles) < 2:
        return list(handles)
    if len({h.key_id for h in handles}) != 1:
        raise ValueError("all handles must belong to the same key")
    rng = np.random.default_rng(seed)
    bases = np.stack([h._states[0] for h in handles])
    values = np.stack([h._states[1] for h in handles])
    perm = np.argsort(rng.random(bases.shape), axis=0)   # independent permutation per position
    new_b = np.take_along_axis(bases, perm, axis=0)
    new_v = np.take_along_axis(values, perm, axis=0)
    return [PublicKeyHandle(h.key_id, h.signer_id, h.verifier_id, _states=(new_b[j], new_v[j]))
            for j, h in enumerate(handles)]
