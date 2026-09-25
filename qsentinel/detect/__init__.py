"""L2 - Quantum-inspired threat detection core: THE TRUST KERNEL. OWNER: Detection Lead.

Rules for this package:
  * every accept/reject rule is closed-form with a stated error bound
  * NO imports of sklearn / torch / tensorflow / any model artefact / qsentinel_ops
    (CI fails otherwise: `lint-imports` + tests/test_no_ml_in_trust_path.py)
"""

from .base import DetectionContext, DetectorResult, Severity
from .channel_monitor import ChannelMonitor, link_id
from .engine import Verdict, evaluate
from .registry import IdentityRegistry, NonceRegistry

__all__ = ["ChannelMonitor", "DetectionContext", "DetectorResult", "IdentityRegistry",
           "NonceRegistry", "Severity", "Verdict", "evaluate", "link_id"]
