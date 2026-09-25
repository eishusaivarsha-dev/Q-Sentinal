"""Attack classes (dossier D6: seven parameterised, seed-reproducible attacks + extras).

Each attack declares: expected decision, which detector(s) must fire, and a default strength.
Some attacks (repudiation) define success differently; they return `ok` explicitly.
"""

from __future__ import annotations

import dataclasses
import secrets
import time
from collections.abc import Callable
from dataclasses import dataclass, field

import numpy as np

from ..detect import Verdict
from ..ledger import find_disputes
from ..pipeline import QSentinel
from ..qds import PublicKeyHandle, Signature, message_digest
from ..quantum import ChannelModel

SIGNER, VERIFIER, VERIFIER2 = "alice", "bob", "charlie"
MSG = b"Transfer approved: order #4411"
EVIL = b"Pay 1 crore to eve"


@dataclass
class Outcome:
    verdict: Verdict
    detail: str
    ok: bool | None = None                 # overrides the default pass rule when set
    tags: list[str] = field(default_factory=list)   # non-detector findings, e.g. "AUDIT"
    metrics: dict = field(default_factory=dict)


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
    ok: bool | None = None
    metrics: dict = field(default_factory=dict)

    @property
    def passed(self) -> bool:
        if self.ok is not None:
            return self.ok
        if self.decision != self.expected_decision:
            return False
        return not self.expected_detectors or bool(set(self.expected_detectors) & set(self.detectors_fired))

    def row(self) -> dict:
        return {"attack": self.attack, "strength": self.strength, "decision": self.decision,
                "fired": ",".join(self.detectors_fired) or "-",
                "expected": ",".join(self.expected_detectors) or "-",
                "result": "PASS" if self.passed else "FAIL", "detail": self.detail}


def _seed(rng) -> int:
    return int(rng.integers(2**62))


def _setup(env: QSentinel) -> None:
    env.register_signer(SIGNER)
    env.register_verifier(VERIFIER)


def _forge(key_id: str, message: bytes, bases, values, counter: int | None = None,
           nonce: bytes | None = None) -> Signature:
    return Signature(signer_id=SIGNER, key_id=key_id, message=message,
                     nonce=nonce or secrets.token_bytes(16),
                     counter=counter if counter is not None else 10_000 + int(time.time()),
                     timestamp=time.time(), revealed_bases=bases, revealed_values=values)


def _info_meter(env: QSentinel, priv, sig: Signature, channel: ChannelModel, seed: int) -> dict:
    """Information-disturbance meter on the revealed key block (simulator omniscience).

    eve_accuracy_with_bits:    Eve also read the 2 teleportation correction bits per round
    eve_accuracy_without_bits: correction bits encrypted (PQC channel) -> should be ~0.5
    disturbance:               error rate Eve caused on the rounds she touched
    """
    L, n = priv.shape
    h = message_digest(sig.message, sig.nonce, L)
    rows = np.arange(L)
    b, v = priv.bases[rows, h].ravel(), priv.values[rows, h].ravel()
    res = env.backend.teleport_and_measure(b, v, b, channel, seed)
    a = res.attacked
    if not a.any():
        return {}
    m0, m1 = res.bsm[:, 0], res.bsm[:, 1]
    eb = res.eve_bases.astype(int)
    fix = np.where(eb == 0, m1, np.where(eb == 1, m0, m0 ^ m1))
    return {
        "probed_fraction": round(float(a.mean()), 4),
        "eve_accuracy_with_bits": round(float(((res.eve_outcomes ^ fix) == v)[a].mean()), 4),
        "eve_accuracy_without_bits": round(float((res.eve_outcomes == v)[a].mean()), 4),
        "disturbance": round(float((res.outcomes != v)[a].mean()), 4),
    }


def _meter_text(m: dict) -> str:
    if not m:
        return ""
    return (f" | Eve accuracy {m['eve_accuracy_with_bits']:.2f} w/ correction bits, "
            f"{m['eve_accuracy_without_bits']:.2f} if bits encrypted; disturbance {m['disturbance']:.2f}")


# --------------------------------------------------------------------------------------------
def honest(env, strength, rng, channel):
    sig = env.sign(SIGNER, MSG, seed=_seed(rng))
    return Outcome(env.verify(sig, VERIFIER, channel, seed=_seed(rng)), "honest signature")


def blind_forgery(env, strength, rng, channel):
    """(i) Forger has no key information and guesses every basis/value."""
    priv = env.issue_key(SIGNER, seed=_seed(rng))   # issued, not yet used by alice
    L, n = priv.shape
    b = rng.choice(np.array(env.settings.protocol.bases, dtype=np.uint8), size=(L, n))
    v = rng.integers(0, 2, size=(L, n), dtype=np.uint8)
    sig = _forge(priv.key_id, EVIL, b, v)
    return Outcome(env.verify(sig, VERIFIER, channel, seed=_seed(rng)), "random guesses")


def known_basis_partial_forgery(env, strength, rng, channel):
    """(ii) Forger learned a fraction `strength` of the key (e.g. side channel)."""
    priv = env.issue_key(SIGNER, seed=_seed(rng))
    L, n = priv.shape
    nonce = secrets.token_bytes(16)
    h = message_digest(EVIL, nonce, L)
    true_b, true_v = priv.bases[np.arange(L), h], priv.values[np.arange(L), h]
    known = rng.random((L, n)) < strength
    b = np.where(known, true_b, rng.choice(np.array(env.settings.protocol.bases, np.uint8), (L, n)))
    v = np.where(known, true_v, rng.integers(0, 2, (L, n))).astype(np.uint8)
    sig = _forge(priv.key_id, EVIL, b.astype(np.uint8), v, nonce=nonce)
    return Outcome(env.verify(sig, VERIFIER, channel, seed=_seed(rng)), f"{strength:.0%} of key leaked")


def intercept_resend(env, strength, rng, channel):
    """(iii) Eve measures a fraction `strength` of Bell-pair halves in transit and resends."""
    priv = env.issue_key(SIGNER, seed=_seed(rng))
    sig = env.sign_with(priv, MSG)
    ch = dataclasses.replace(channel, intercept_fraction=strength)
    meter = _info_meter(env, priv, sig, ch, _seed(rng))
    return Outcome(env.verify(sig, VERIFIER, ch, seed=_seed(rng)),
                   f"{strength:.0%} intercepted" + _meter_text(meter), metrics=meter)


def entangle_and_measure(env, strength, rng, channel):
    """(iv) Eve CNOT-couples an ancilla to each probed qubit (Z-basis copy) and measures it
    later - a collective attack that never 'resends' anything."""
    priv = env.issue_key(SIGNER, seed=_seed(rng))
    sig = env.sign_with(priv, MSG)
    ch = dataclasses.replace(channel, entangle_fraction=strength, entangle_basis=0)
    meter = _info_meter(env, priv, sig, ch, _seed(rng))
    return Outcome(env.verify(sig, VERIFIER, ch, seed=_seed(rng)),
                   f"{strength:.0%} probed with ancilla" + _meter_text(meter), metrics=meter)


def stealth_probe(env, strength, rng, channel):
    """Low-rate single-basis intercept that keeps QBER far below the 11% threshold.
    The signature is genuine (ACCEPT is correct); the CHANNEL is being probed (D4 warning)."""
    sig = env.sign(SIGNER, MSG, seed=_seed(rng))
    ch = dataclasses.replace(channel, intercept_fraction=strength, eve_bases=(0,))
    v = env.verify(sig, VERIFIER, ch, seed=_seed(rng))
    fp = v.result("D4").extra["fingerprint"]
    est = fp["est_intercept_fraction"]
    return Outcome(v, f"{strength:.0%} Z-basis probe, QBER {v.result('D4').statistic:.3f}; "
                      f"fingerprint: {fp['label']}; est. fraction {est if est is None else round(est, 3)}",
                   ok=v.result("D4").alert)   # success = the probe was NOTICED (warn or reject)


def replay(env, strength, rng, channel):
    """(v) Re-submit a previously accepted signature."""
    sig = env.sign(SIGNER, MSG, seed=_seed(rng))
    first = env.verify(sig, VERIFIER, channel, seed=_seed(rng))
    second = env.verify(sig, VERIFIER, channel, seed=_seed(rng))
    return Outcome(second, f"first submission {first.decision}")


def key_reuse_forgery(env, strength, rng, channel):
    """Forger reuses a consumed one-time key: copies the revealed blocks where the new digest
    agrees with the old one and guesses the rest."""
    sig = env.sign(SIGNER, MSG, seed=_seed(rng))
    env.verify(sig, VERIFIER, channel, seed=_seed(rng))
    L = sig.revealed_bases.shape[0]
    nonce = secrets.token_bytes(16)
    same = message_digest(EVIL, nonce, L) == message_digest(sig.message, sig.nonce, L)
    b = np.where(same[:, None], sig.revealed_bases,
                 rng.choice(np.array(env.settings.protocol.bases, np.uint8), sig.revealed_bases.shape))
    v = np.where(same[:, None], sig.revealed_values, rng.integers(0, 2, sig.revealed_values.shape))
    forged = _forge(sig.key_id, EVIL, b.astype(np.uint8), v.astype(np.uint8),
                    counter=sig.counter + 1, nonce=nonce)
    return Outcome(env.verify(forged, VERIFIER, channel, seed=_seed(rng)),
                   f"reused key, {int(same.sum())}/{L} blocks copied")


def mitm_message_swap(env, strength, rng, channel):
    """(vi) MITM on the classical channel keeps the signature, swaps the message."""
    sig = env.sign(SIGNER, MSG, seed=_seed(rng))
    tampered = dataclasses.replace(sig, message=b"Transfer approved: order #9999")
    return Outcome(env.verify(tampered, VERIFIER, channel, seed=_seed(rng)), "message swapped")


def _repudiation(env, strength, rng, channel, protect: bool) -> Outcome:
    env.register_verifier(VERIFIER2)
    priv = env.issue_key(SIGNER, seed=_seed(rng), symmetrise_copies=False)
    # Dishonest Alice sends Charlie a copy with a fraction `strength` of positions randomised.
    pub = env._pubkeys[(priv.key_id, VERIFIER2)]
    b, v = pub._states[0].copy(), pub._states[1].copy()
    mask = rng.random(b.shape) < strength
    b[mask] = rng.choice(np.array(env.settings.protocol.bases, np.uint8), int(mask.sum()))
    v[mask] = rng.integers(0, 2, int(mask.sum()))
    env._pubkeys[(priv.key_id, VERIFIER2)] = PublicKeyHandle(priv.key_id, SIGNER, VERIFIER2,
                                                             _states=(b, v))
    if protect:
        env.symmetrise_key(priv.key_id)
    sig = env.sign_with(priv, MSG)
    vb = env.verify(sig, VERIFIER, channel, seed=_seed(rng))
    vc = env.verify(sig, VERIFIER2, channel, seed=_seed(rng), transferred=True)
    if protect:
        env.reveal_symmetrisation(priv.key_id)
    disputes = [d for d in find_disputes(env.ledger) if d["key_id"] == priv.key_id]
    # The only harmful split: strict direct verifier ACCEPTS, lenient forwarded one REJECTS.
    violation = vb.decision == "ACCEPT" and vc.decision == "REJECT"
    detail = (f"bob={vb.decision} charlie(transferred)={vc.decision}; "
              + ("symmetrised" if protect else "NOT symmetrised")
              + ("; ledger audit: DISPUTE flagged" if disputes else "; transferability holds"))
    ok = (not violation) if protect else (not violation or bool(disputes))
    return Outcome(vc, detail, ok=ok, tags=["AUDIT"] if disputes else [],
                   metrics={"violation": violation, "disputes": len(disputes),
                            "bob": vb.decision, "charlie": vc.decision, "symmetrised": protect})


def repudiation(env, strength, rng, channel):
    """(vii) Signer equivocates (different states to different verifiers) so she can later deny.
    With symmetrisation she cannot make a signature that the strict first recipient accepts but a
    forwarded (lenient) recipient rejects. Success = no such violation."""
    return _repudiation(env, strength, rng, channel, protect=True)


def repudiation_unprotected(env, strength, rng, channel):
    """Same attack without symmetrisation: verdicts split, and the ledger audit must flag it."""
    return _repudiation(env, strength, rng, channel, protect=False)


def impersonation(env, strength, rng, channel):
    """Mallory presents alice's key under her own name."""
    sig = env.sign(SIGNER, MSG, seed=_seed(rng))
    fake = dataclasses.replace(sig, signer_id="mallory")
    return Outcome(env.verify(fake, VERIFIER, channel, seed=_seed(rng)), "claims to be mallory")


def unauthorised_verification(env, strength, rng, channel):
    """A party outside RBAC tries to verify (and learn about) a signature."""
    sig = env.sign(SIGNER, MSG, seed=_seed(rng))
    return Outcome(env.verify(sig, "mallory", channel, seed=_seed(rng)), "verifier=mallory")


def stolen_key_honeypot(env, strength, rng, channel):
    """Insider dumps the signer's key store and signs with an unused key. The signature is
    PHYSICALLY VALID (D2 passes); only the honeypot tripwire can catch it."""
    for _ in range(4):
        env.issue_honeypot(SIGNER, seed=_seed(rng))
    unused = [k for k in env._keystore.values() if not k.used]
    priv = unused[int(rng.integers(len(unused)))]
    sig = env.sign_with(priv, EVIL)
    v = env.verify(sig, VERIFIER, channel, seed=_seed(rng))
    return Outcome(v, f"valid signature from stolen key; D2 alert={v.result('D2').alert}")


@dataclass(frozen=True)
class AttackSpec:
    fn: Callable
    expected: str
    detectors: list[str]
    default_strength: float = 1.0


ATTACKS: dict[str, AttackSpec] = {
    "honest": AttackSpec(honest, "ACCEPT", []),
    "blind_forgery": AttackSpec(blind_forgery, "REJECT", ["D2"]),
    "known_basis_partial_forgery": AttackSpec(known_basis_partial_forgery, "REJECT", ["D2"], 0.5),
    "intercept_resend": AttackSpec(intercept_resend, "REJECT", ["D3", "D4"]),
    "entangle_and_measure": AttackSpec(entangle_and_measure, "REJECT", ["D3", "D4"]),
    "stealth_probe": AttackSpec(stealth_probe, "-", ["D4"], 0.06),
    "replay": AttackSpec(replay, "REJECT", ["D5"]),
    "key_reuse_forgery": AttackSpec(key_reuse_forgery, "REJECT", ["D5"]),
    "mitm_message_swap": AttackSpec(mitm_message_swap, "REJECT", ["D2"]),
    "repudiation": AttackSpec(repudiation, "-", [], 0.4),
    "repudiation_unprotected": AttackSpec(repudiation_unprotected, "-", ["AUDIT"], 0.4),
    "impersonation": AttackSpec(impersonation, "REJECT", ["D6"]),
    "unauthorised_verification": AttackSpec(unauthorised_verification, "REJECT", ["D6"]),
    "stolen_key_honeypot": AttackSpec(stolen_key_honeypot, "REJECT", ["D6"]),
}


def run_attack(env: QSentinel, name: str, strength: float | None = None, seed: int = 0,
               channel: ChannelModel = ChannelModel()) -> AttackReport:
    spec = ATTACKS[name]
    strength = spec.default_strength if strength is None else strength
    _setup(env)
    out: Outcome = spec.fn(env, strength, np.random.default_rng(seed), channel)
    return AttackReport(name, strength, out.verdict.decision, spec.expected,
                        [r.detector for r in out.verdict.alerts] + out.tags, spec.detectors,
                        out.detail, out.verdict.to_dict(), out.ok, out.metrics)
