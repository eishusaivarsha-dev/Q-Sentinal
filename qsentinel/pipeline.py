"""End-to-end orchestration: sign -> teleport -> verify -> detect -> ledger -> telemetry."""

from __future__ import annotations

import secrets
from dataclasses import dataclass, field

from .config import Settings
from .detect import DetectionContext, IdentityRegistry, NonceRegistry, Verdict, evaluate
from .ledger import HashChainLedger
from .qds import PrivateKey, PublicKeyHandle, Signature, distribute, keygen, sign, verify
from .quantum import ChannelModel, QuantumBackend, get_backend
from .telemetry import TelemetryBus


@dataclass
class QSentinel:
    settings: Settings = field(default_factory=Settings)
    backend: QuantumBackend = field(default_factory=get_backend)
    ledger: HashChainLedger = field(default_factory=HashChainLedger)
    telemetry: TelemetryBus = field(default_factory=TelemetryBus)
    nonces: NonceRegistry = field(default_factory=NonceRegistry)
    identities: IdentityRegistry = field(default_factory=IdentityRegistry)
    signers: set[str] = field(default_factory=set)
    _counters: dict[str, int] = field(default_factory=dict)
    _pubkeys: dict[tuple[str, str], PublicKeyHandle] = field(default_factory=dict)

    # --- enrolment -----------------------------------------------------------------------
    def register_signer(self, signer_id: str) -> None:
        self.signers.add(signer_id)

    def register_verifier(self, verifier_id: str) -> None:
        self.identities.authorised_verifiers.add(verifier_id)

    # --- signer side ---------------------------------------------------------------------
    def issue_key(self, signer_id: str, seed: int | None = None) -> PrivateKey:
        """Fresh one-time key, teleported to every authorised verifier."""
        if signer_id not in self.signers:
            raise PermissionError(f"unknown signer {signer_id!r}")
        priv = keygen(signer_id, self.settings.protocol, seed)
        self.identities.bind_key(priv.key_id, signer_id)
        for v in self.identities.authorised_verifiers:
            self._pubkeys[(priv.key_id, v)] = distribute(priv, v)
        self.telemetry.publish("key_issued", {"signer_id": signer_id, "key_id": priv.key_id})
        return priv

    def sign(self, signer_id: str, message: bytes, seed: int | None = None) -> Signature:
        priv = self.issue_key(signer_id, seed)
        self._counters[signer_id] = self._counters.get(signer_id, -1) + 1
        return sign(priv, message, self._counters[signer_id])

    # --- verifier side -------------------------------------------------------------------
    def public_key(self, key_id: str, verifier_id: str) -> PublicKeyHandle:
        pub = self._pubkeys.get((key_id, verifier_id))
        if pub is not None:
            return pub
        # Key exists but was never distributed to this verifier (unauthorised verification
        # attempt): let it run so D6 records the attempt, instead of failing silently.
        other = next((p for (k, _), p in self._pubkeys.items() if k == key_id), None)
        if other is None:
            raise KeyError(f"unknown key {key_id!r}")
        return PublicKeyHandle(key_id, other.signer_id, verifier_id, _states=other._states)

    def verify(self, sig: Signature, verifier_id: str, channel: ChannelModel = ChannelModel(),
               seed: int | None = None) -> Verdict:
        seed = secrets.randbits(63) if seed is None else seed
        pub = self.public_key(sig.key_id, verifier_id)
        transcript = verify(sig, pub, self.backend, channel, seed)
        bell = self.backend.bell_correlators(self.settings.detectors.bell_test_pairs, channel,
                                             seed + 1)
        ctx = DetectionContext(signature=sig, pubkey=pub, transcript=transcript,
                               settings=self.settings, nonces=self.nonces,
                               identities=self.identities, bell=bell)
        verdict = evaluate(ctx)
        entry = self.ledger.append("verdict", {
            "decision": verdict.decision,
            "transcript_hash": verdict.certificate["transcript_hash"],
            "signer_id": sig.signer_id, "key_id": sig.key_id, "verifier_id": verifier_id,
            "nonce": sig.nonce.hex(), "counter": sig.counter,
        })
        verdict.certificate["ledger_index"] = entry.index
        verdict.certificate["ledger_entry_hash"] = entry.entry_hash
        self.telemetry.publish("verdict", {
            "decision": verdict.decision, "verifier_id": verifier_id, "key_id": sig.key_id,
            "qber": transcript.qber,
            "chsh": next(r.extra.get("chsh") for r in verdict.results if r.detector == "D3"),
            "alerts": [r.to_dict() for r in verdict.alerts],
        })
        return verdict
