"""Central protocol + detector configuration.

Defaults follow docs/protocol.md: six-state encoding, n = 256 rounds per hash bit,
noise tolerance tau = 0.10  ->  forgery bound <= 1e-16 per bit block.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# Per-round mismatch probability an uninformed forger is guaranteed to suffer.
FORGER_MISMATCH = {"two-basis": 0.25, "six-state": 1 / 3}
BASIS_SETS = {"two-basis": (0, 1), "six-state": (0, 1, 2)}  # 0=Z, 1=X, 2=Y


@dataclass(frozen=True)
class ProtocolConfig:
    basis_set: str = "six-state"
    rounds_per_bit: int = 256        # n
    hash_bits: int = 256             # L (Lamport-style binding of the message digest)
    tau: float = 0.10                # max mismatch fraction per block, DIRECT recipient
    tau_transfer: float = 0.14       # looser threshold for a FORWARDED signature. The gap
    #                                  tau < tau_transfer is what makes signatures transferable.
    symmetrise: bool = True          # verifiers shuffle their public-key copies (anti-repudiation)

    @property
    def bases(self) -> tuple[int, ...]:
        return BASIS_SETS[self.basis_set]

    @property
    def forger_mismatch(self) -> float:
        return FORGER_MISMATCH[self.basis_set]


@dataclass(frozen=True)
class DetectorConfig:
    qber_max: float = 0.11           # D4: Shor-Preskill style channel threshold
    expected_noise: float = 0.02     # D4: SPRT null-hypothesis floor (honest channel QBER)
    attack_qber: float = 0.25        # D4: SPRT alternative hypothesis
    sprt_alpha: float = 1e-6         # false-alarm rate
    sprt_beta: float = 1e-6          # missed-detection rate
    chi2_pvalue_min: float = 1e-3    # D4: BSM uniformity
    fingerprint_alpha: float = 1e-4  # D4: Pauli-fingerprint drift test significance
    fingerprint_min_effect: float = 0.005  # D4: ignore drifts smaller than 0.5% absolute
    cusum_slack: float = 0.005       # D4: channel-level CUSUM k (per-verification QBER excess)
    cusum_threshold: float = 0.03    # D4: channel-level CUSUM h
    chsh_min: float = 2.0            # D3: classical (local hidden variable) bound
    chsh_drop_z: float = 4.0         # D3: significant drop vs commissioning baseline
    fidelity_min: float = 0.90       # D3: Bell-state fidelity
    bell_test_pairs: int = 2000      # D3: sacrificial pairs per channel check
    bell_window: int = 10            # D3: rolling window of Bell checks per link
    timestamp_window_s: float = 300  # D5: freshness window
    commission_rounds: int = 30_000  # link commissioning: test rounds for the frozen baseline
    commission_pairs: int = 4000     # link commissioning: Bell pairs for the frozen baseline


@dataclass(frozen=True)
class LedgerConfig:
    merkle_batch: int = 8            # anchor one Merkle root per this many verdicts


@dataclass(frozen=True)
class Settings:
    protocol: ProtocolConfig = field(default_factory=ProtocolConfig)
    detectors: DetectorConfig = field(default_factory=DetectorConfig)
    ledger: LedgerConfig = field(default_factory=LedgerConfig)


# Small config for fast unit tests / CI.
FAST = Settings(protocol=ProtocolConfig(rounds_per_bit=64, hash_bits=32, tau=0.10))
