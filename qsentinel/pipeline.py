"""End-to-end orchestration: sign -> teleport -> verify -> detect -> ledger -> telemetry.

Lifecycle of one key:
  issue_key        keygen -> teleport a copy to every authorised verifier -> (symmetrise:
                   verifiers commit shares on-chain, shuffle their copies)
  sign / sign_with reveal one block per digest bit (key burned)
  verify           commission the link if new (frozen baseline) -> measure -> D1-D6 ->
                   ledger (verdict + periodic Merkle anchor) -> telemetry
  reveal_symmetrisation   publish the shares (after use, or for a dispute)
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass, field

import numpy as np

from .config import Settings
from .detect import (
    ChannelMonitor,
    DetectionContext,
    IdentityRegistry,
    NonceRegistry,
    Verdict,
    evaluate,
    link_id,
)
from .detect.fingerprint import per_basis_counts
from .ledger import HashChainLedger, rebuild_freshness
from .ledger.commit_reveal import commitment, joint_seed
from .qds import PrivateKey, PublicKeyHandle, Signature, distribute, keygen, sign, symmetrise, verify
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
    monitor: ChannelMonitor | None = None
    signers: set[str] = field(default_factory=set)
    _counters: dict[str, int] = field(default_factory=dict)
    _pubkeys: dict[tuple[str, str], PublicKeyHandle] = field(default_factory=dict)
    _keystore: dict[str, PrivateKey] = field(default_factory=dict)       # signer's key store
    _sym_shares: dict[str, dict[str, tuple[bytes, bytes]]] = field(default_factory=dict)

    def __post_init__(self):
        if self.monitor is None:
            self.monitor = ChannelMonitor(window=self.settings.detectors.bell_window)
        if self.ledger.entries:   # restart: replay protection is rebuilt from the ledger
            self.nonces = rebuild_freshness(self.ledger)

    # --- enrolment -----------------------------------------------------------------------
    def register_signer(self, signer_id: str) -> None:
        self.signers.add(signer_id)

    def register_verifier(self, verifier_id: str) -> None:
        self.identities.authorised_verifiers.add(verifier_id)

    def commission_link(self, signer_id: str, verifier_id: str,
                        channel: ChannelModel = ChannelModel(), seed: int | None = None) -> dict:
        """Measure the link's natural noise in a trusted window and FREEZE it as the baseline.

        Test rounds use states that are revealed immediately, so every mismatch is channel
        noise. The baseline is written to the ledger: it is auditable, and changing it later
        needs an explicit, logged re-commissioning.
        """
        cfg = self.settings.detectors
        rng = np.random.default_rng(secrets.randbits(63) if seed is None else seed)
        n = cfg.commission_rounds
        b = rng.choice(np.array(self.settings.protocol.bases), n)
        v = rng.integers(0, 2, n)
        honest = channel.honest_part()
        res = self.backend.teleport_and_measure(b, v, b, honest, int(rng.integers(2**62)))
        counts = per_basis_counts(b, res.outcomes != v, self.settings.protocol.bases)
        bell = self.backend.bell_correlators(cfg.commission_pairs, honest, int(rng.integers(2**62)))
        link = link_id(signer_id, verifier_id)
        base = self.monitor.commission(link, counts, bell, cfg.commission_pairs)
        self.ledger.append("link_commissioned", {"link": link, **base.summary()})
        return base.summary()

    # --- signer side ---------------------------------------------------------------------
    def issue_key(self, signer_id: str, seed: int | None = None, symmetrise_copies: bool | None = None,
                  honeypot: bool = False) -> PrivateKey:
        """Fresh one-time key, teleported to every authorised verifier (then symmetrised)."""
        if signer_id not in self.signers:
            raise PermissionError(f"unknown signer {signer_id!r}")
        priv = keygen(signer_id, self.settings.protocol, seed)
        self.identities.bind_key(priv.key_id, signer_id)
        for v in sorted(self.identities.authorised_verifiers):
            self._pubkeys[(priv.key_id, v)] = distribute(priv, v)
        self._keystore[priv.key_id] = priv
        if honeypot:
            self.identities.honeypots.add(priv.key_id)
        do_sym = self.settings.protocol.symmetrise if symmetrise_copies is None else symmetrise_copies
        if do_sym:
            self.symmetrise_key(priv.key_id)
        self.telemetry.publish("key_issued", {"signer_id": signer_id, "key_id": priv.key_id})
        return priv

    def issue_honeypot(self, signer_id: str, seed: int | None = None) -> str:
        """Decoy key: distributed exactly like a real one, never used to sign."""
        return self.issue_key(signer_id, seed, honeypot=True).key_id

    def symmetrise_key(self, key_id: str) -> None:
        """Verifiers commit random shares on-chain, derive a joint seed, shuffle their copies."""
        verifiers = sorted(v for (k, v) in self._pubkeys if k == key_id)
        if len(verifiers) < 2:
            return
        shares = {v: (secrets.token_bytes(32), secrets.token_bytes(16)) for v in verifiers}
        self.ledger.append("sym_commit", {
            "key_id": key_id,
            "commitments": {v: commitment(key_id, v, s, salt) for v, (s, salt) in shares.items()}})
        seed = joint_seed(key_id, {v: s for v, (s, _) in shares.items()})
        new = symmetrise([self._pubkeys[(key_id, v)] for v in verifiers], seed)
        for v, h in zip(verifiers, new, strict=True):
            self._pubkeys[(key_id, v)] = h
        self._sym_shares[key_id] = shares

    def reveal_symmetrisation(self, key_id: str):
        shares = self._sym_shares.get(key_id)
        if shares is None:
            raise KeyError(f"no symmetrisation for key {key_id!r}")
        return self.ledger.append("sym_reveal", {
            "key_id": key_id,
            "reveals": {v: {"share": s.hex(), "salt": salt.hex()} for v, (s, salt) in shares.items()}})

    def sign(self, signer_id: str, message: bytes, seed: int | None = None) -> Signature:
        return self.sign_with(self.issue_key(signer_id, seed), message)

    def sign_with(self, priv: PrivateKey, message: bytes) -> Signature:
        self._counters[priv.signer_id] = self._counters.get(priv.signer_id, -1) + 1
        return sign(priv, message, self._counters[priv.signer_id])

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
               seed: int | None = None, transferred: bool = False) -> Verdict:
        seed = secrets.randbits(62) if seed is None else seed
        pub = self.public_key(sig.key_id, verifier_id)
        owner = self.identities.key_owner.get(sig.key_id, sig.signer_id)
        link = link_id(owner, verifier_id)
        if not self.monitor.has(link):
            # Simulation shortcut for the trusted commissioning window: the link's natural noise
            # is the channel minus any attack component.
            self.commission_link(owner, verifier_id, channel.honest_part(), seed=seed + 7)
        transcript = verify(sig, pub, self.backend, channel, seed)
        pairs = self.settings.detectors.bell_test_pairs
        bell = self.backend.bell_correlators(pairs, channel, seed + 1)
        ctx = DetectionContext(signature=sig, pubkey=pub, transcript=transcript,
                               settings=self.settings, nonces=self.nonces,
                               identities=self.identities, bell=bell, bell_pairs=pairs,
                               monitor=self.monitor, link=link, transferred=transferred)
        verdict = evaluate(ctx)
        entry = self.ledger.append("verdict", {
            "decision": verdict.decision,
            "transcript_hash": verdict.certificate["transcript_hash"],
            "signer_id": sig.signer_id, "key_id": sig.key_id, "verifier_id": verifier_id,
            "nonce": sig.nonce.hex(), "counter": sig.counter, "transferred": transferred,
            "link": link,
        })
        self.ledger.anchor(batch=self.settings.ledger.merkle_batch)
        verdict.certificate["ledger_index"] = entry.index
        verdict.certificate["ledger_entry_hash"] = entry.entry_hash
        verdict.certificate["merkle_proof"] = self.ledger.inclusion_proof(entry.index) or "pending"
        self.telemetry.publish("verdict", {
            "decision": verdict.decision, "verifier_id": verifier_id, "key_id": sig.key_id,
            "link": link, "transferred": transferred, "qber": transcript.qber,
            "chsh": verdict.result("D3").extra.get("chsh"),
            "fingerprint": verdict.result("D4").extra["fingerprint"]["label"],
            "alerts": [r.to_dict() for r in verdict.alerts],
        })
        return verdict
