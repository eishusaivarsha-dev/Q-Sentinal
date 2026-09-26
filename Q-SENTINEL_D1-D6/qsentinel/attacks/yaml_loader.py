"""Load simple attack campaign YAML configuration."""

from __future__ import annotations

from pathlib import Path
import yaml


def load_campaign(path: str | Path) -> dict:
    with Path(path).open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle)
