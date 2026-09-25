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
    tau: float = 0.10                # max tolerated mismatch fraction per bit block

    @property
    def bases(self) -> tuple[int, ...]:
        return BASIS_SETS[self.basis_set]

    @property
    def forger_mismatch(self) -> float:
        return FORGER_MISMATCH[self.basis_set]


@dataclass(frozen=True)
class DetectorConfig:
    qber_max: float = 0.11           # D4: Shor-Preskill style channel threshold
    expected_noise: float = 0.02     # D4: SPRT null hypothesis (honest channel QBER)
    attack_qber: float = 0.25        # D4: SPRT alternative hypothesis
    sprt_alpha: float = 1e-6         # false-alarm rate
    sprt_beta: float = 1e-6          # missed-detection rate
    chi2_pvalue_min: float = 1e-3    # D4: BSM uniformity
    chsh_min: float = 2.0            # D3: classical (local hidden variable) bound
    fidelity_min: float = 0.90       # D3: Bell-state fidelity
    bell_test_pairs: int = 2000      # D3: sacrificial pairs per channel check
    timestamp_window_s: float = 300  # D5: freshness window


@dataclass(frozen=True)
class Settings:
    protocol: ProtocolConfig = field(default_factory=ProtocolConfig)
    detectors: DetectorConfig = field(default_factory=DetectorConfig)


# Small config for fast unit tests / CI.
FAST = Settings(protocol=ProtocolConfig(rounds_per_bit=64, hash_bits=32, tau=0.10))
