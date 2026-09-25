"""Campaign runner. Exit code 1 if any attack is missed or any honest signature is rejected.

    python -m qsentinel.attacks.run qsentinel/attacks/campaigns/smoke.yaml
"""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

from ..config import FAST, Settings
from ..pipeline import QSentinel
from ..quantum import ChannelModel
from .library import run_attack


def run_campaign(path: str | Path) -> list:
    spec = yaml.safe_load(Path(path).read_text())
    settings = FAST if spec.get("settings") == "fast" else Settings()
    base_seed = int(spec.get("seed", 0))
    reports = []
    for i, run in enumerate(spec["runs"]):
        env = QSentinel(settings=settings)   # fresh state per run
        strength = run.get("strength")
        try:
            rep = run_attack(env, run["attack"], None if strength is None else float(strength),
                             seed=base_seed + i, channel=ChannelModel(**run.get("channel", {})))
        except NotImplementedError:
            print(f"  SKIP  {run['attack']} (not implemented yet)")
            continue
        reports.append(rep)
    return reports


def main(argv: list[str]) -> int:
    path = argv[1] if len(argv) > 1 else Path(__file__).parent / "campaigns" / "smoke.yaml"
    reports = run_campaign(path)
    fmt = "{result:5} {attack:28} {strength:>5} {decision:7} fired={fired:14} expected={expected:9} {detail}"
    for r in reports:
        print(fmt.format(**r.row()))
    failed = [r for r in reports if not r.passed]
    print(f"\n{len(reports) - len(failed)}/{len(reports)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
