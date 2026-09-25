"""Attack classes (dossier D6: seven parameterised, seed-reproducible attacks + extras)."""

from __future__ import annotations

import dataclasses
import secrets
import time
from collections.abc import Callable
from dataclasses import dataclass, field

import numpy as np

from ..detect import Verdict
from ..pipeline import QSentinel
from ..qds import Signature
from ..quantum import ChannelModel

SIGNER, VERIFIER = "alice", "bob"


@dataclass
class AttackReport:
    attack: str
    strength: float
    decision: str
    expected_decision: str
    detectors_fired: list[str]
    expected_detectors: list[str]
    detail: str = ""
    verdict: dict = field(default_factory=dict, repr=False)

    @property
    def passed(self) -> bool:
        if self.decision != self.expected_decision:
            return False
        return not self.expected_detectors or bool(set(self.expected_detectors) & set(self.detectors_fired))

    def row(self) -> dict:
        return {"attack": self.attack, "strength": self.strength, "decision": self.decision,
                "fired": ",".join(self.detectors_fired) or "-",
                "expected": ",".join(self.expected_detectors) or "-",
                "result": "PASS" if self.passed else "FAIL", "detail": self.detail}


def _fired(v: Verdict) -> list[str]:
    return [r.detector for r in v.alerts]


def _setup(env: QSentinel) -> None:
    env.register_signer(SIGNER)
    env.register_verifier(VERIFIER)


def _forge(env: QSentinel, key_id: str, message: bytes, bases, values) -> Signature:
    return Signature(signer_id=SIGNER, key_id=key_id, message=message,
                     nonce=secrets.token_bytes(16), counter=10_000 + int(time.time()),
                     timestamp=time.time(), revealed_bases=bases, revealed_values=values)


# --------------------------------------------------------------------------------------------
def honest(env, strength, rng, channel):
    sig = env.sign(SIGNER, b"Transfer approved: order #4411", seed=int(rng.integers(2**62)))
    return env.verify(sig, VERIFIER, channel, seed=int(rng.integers(2**62))), "honest signature"


def blind_forgery(env, strength, rng, channel):
    """(i) Forger has no key information and guesses every basis/value."""
    priv = env.issue_key(SIGNER, seed=int(rng.integers(2**62)))   # issued, not yet used by alice
    L, n = priv.shape
    b = rng.choice(np.array(env.settings.protocol.bases, dtype=np.uint8), size=(L, n))
    v = rng.integers(0, 2, size=(L, n), dtype=np.uint8)
    sig = _forge(env, priv.key_id, b"Pay 1 crore to eve", b, v)
    return env.verify(sig, VERIFIER, channel, seed=int(rng.integers(2**62))), "random guesses"


def known_basis_partial_forgery(env, strength, rng, channel):
    """(ii) Forger somehow learned a fraction `strength` of the key (e.g. side channel)."""
    from ..qds import message_digest
    priv = env.issue_key(SIGNER, seed=int(rng.integers(2**62)))
    L, n = priv.shape
    msg, nonce = b"Pay 1 crore to eve", secrets.token_bytes(16)
    h = message_digest(msg, nonce, L)
    true_b, true_v = priv.bases[np.arange(L), h], priv.values[np.arange(L), h]
    known = rng.random((L, n)) < strength
    b = np.where(known, true_b, rng.choice(np.array(env.settings.protocol.bases, np.uint8), (L, n)))
    v = np.where(known, true_v, rng.integers(0, 2, (L, n))).astype(np.uint8)
    sig = dataclasses.replace(_forge(env, priv.key_id, msg, b.astype(np.uint8), v), nonce=nonce)
    return env.verify(sig, VERIFIER, channel, seed=int(rng.integers(2**62))), \
        f"{strength:.0%} of key leaked"


def intercept_resend(env, strength, rng, channel):
    """(iii) Eve measures a fraction `strength` of Bell-pair halves in transit and resends."""
    sig = env.sign(SIGNER, b"Transfer approved: order #4411", seed=int(rng.integers(2**62)))
    ch = dataclasses.replace(channel, intercept_fraction=strength)
    return env.verify(sig, VERIFIER, ch, seed=int(rng.integers(2**62))), f"{strength:.0%} intercepted"


def entangle_and_measure(env, strength, rng, channel):
    """(iv) Eve entangles an ancilla with each transit qubit, measures later (collective attack).
    TODO(security-lead): model as partial CNOT/ancilla in StimBackend._channel."""
    raise NotImplementedError


def replay(env, strength, rng, channel):
    """(v) Re-submit a previously accepted signature."""
    sig = env.sign(SIGNER, b"Transfer approved: order #4411", seed=int(rng.integers(2**62)))
    first = env.verify(sig, VERIFIER, channel, seed=int(rng.integers(2**62)))
    second = env.verify(sig, VERIFIER, channel, seed=int(rng.integers(2**62)))
    return second, f"first submission {first.decision}"


def mitm_message_swap(env, strength, rng, channel):
    """(vi) MITM on the classical channel keeps the signature, swaps the message."""
    sig = env.sign(SIGNER, b"Transfer approved: order #4411", seed=int(rng.integers(2**62)))
    tampered = dataclasses.replace(sig, message=b"Transfer approved: order #9999")
    return env.verify(tampered, VERIFIER, channel, seed=int(rng.integers(2**62))), "message swapped"


def repudiation(env, strength, rng, channel):
    """(vii) Signer sends inconsistent public keys to different verifiers, later denies.
    TODO(blockchain-lead + quantum-lead): needs symmetrisation / commit-reveal (docs/protocol.md)."""
    raise NotImplementedError


def impersonation(env, strength, rng, channel):
    """Mallory presents alice's key under her own name."""
    sig = env.sign(SIGNER, b"Transfer approved: order #4411", seed=int(rng.integers(2**62)))
    fake = dataclasses.replace(sig, signer_id="mallory")
    return env.verify(fake, VERIFIER, channel, seed=int(rng.integers(2**62))), "claims to be mallory"


def unauthorised_verification(env, strength, rng, channel):
    """A party outside RBAC tries to verify (and learn about) a signature."""
    sig = env.sign(SIGNER, b"Transfer approved: order #4411", seed=int(rng.integers(2**62)))
    return env.verify(sig, "mallory", channel, seed=int(rng.integers(2**62))), "verifier=mallory"


# name -> (fn, expected decision, detectors that must fire)
ATTACKS: dict[str, tuple[Callable, str, list[str]]] = {
    "honest": (honest, "ACCEPT", []),
    "blind_forgery": (blind_forgery, "REJECT", ["D2"]),
    "known_basis_partial_forgery": (known_basis_partial_forgery, "REJECT", ["D2"]),
    "intercept_resend": (intercept_resend, "REJECT", ["D3", "D4"]),
    "entangle_and_measure": (entangle_and_measure, "REJECT", ["D3", "D4"]),
    "replay": (replay, "REJECT", ["D5"]),
    "mitm_message_swap": (mitm_message_swap, "REJECT", ["D2"]),
    "repudiation": (repudiation, "REJECT", []),
    "impersonation": (impersonation, "REJECT", ["D6"]),
    "unauthorised_verification": (unauthorised_verification, "REJECT", ["D6"]),
}


def run_attack(env: QSentinel, name: str, strength: float = 1.0, seed: int = 0,
               channel: ChannelModel = ChannelModel()) -> AttackReport:
    fn, expected, detectors = ATTACKS[name]
    _setup(env)
    verdict, detail = fn(env, strength, np.random.default_rng(seed), channel)
    return AttackReport(name, strength, verdict.decision, expected, _fired(verdict), detectors,
                        detail, verdict.to_dict())
