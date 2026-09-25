"""L0 - Quantum substrate. OWNER: Quantum Lead.

Every backend implements the same `QuantumBackend` interface so detection code runs
unchanged on the ideal simulator, a noisy model, or real IBM hardware (USP-5).
"""

from .backend import ChannelModel, QuantumBackend, RoundResult, get_backend
from .types import BASIS_NAMES, Basis

__all__ = ["Basis", "BASIS_NAMES", "ChannelModel", "QuantumBackend", "RoundResult", "get_backend"]
