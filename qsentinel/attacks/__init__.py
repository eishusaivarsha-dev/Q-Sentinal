"""L4 - Attack simulation & evaluation harness. OWNER: Security Lead.

Each attack is seed-reproducible and declares which detector(s) must catch it.
Run a campaign:  python -m qsentinel.attacks.run qsentinel/attacks/campaigns/smoke.yaml
"""

from .library import ATTACKS, AttackReport, run_attack

__all__ = ["ATTACKS", "AttackReport", "run_attack"]
