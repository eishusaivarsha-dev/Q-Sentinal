"""Static trust-path guard used by CI and tests.

The D4 package must remain AI/ML-free. This module scans source text for
forbidden ML imports/artifacts.
"""

from __future__ import annotations

from pathlib import Path
import ast

FORBIDDEN_IMPORT_ROOTS = {"sklearn", "torch", "tensorflow"}
FORBIDDEN_STRINGS = ("model" + ".pkl", "model" + ".joblib", "state" + "_dict", "on" + "nx")


def scan_detect_tree(root: Path) -> list[str]:
    violations: list[str] = []
    for path in root.rglob("*.py"):
        source = path.read_text(encoding="utf-8")
        if any(token in source for token in FORBIDDEN_STRINGS):
            violations.append(f"forbidden model artifact token in {path}")
        try:
            tree = ast.parse(source)
        except SyntaxError as exc:
            violations.append(f"syntax error in {path}: {exc}")
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    root_name = alias.name.split(".")[0]
                    if root_name in FORBIDDEN_IMPORT_ROOTS:
                        violations.append(f"forbidden ML import {alias.name} in {path}")
            elif isinstance(node, ast.ImportFrom) and node.module:
                root_name = node.module.split(".")[0]
                if root_name in FORBIDDEN_IMPORT_ROOTS:
                    violations.append(f"forbidden ML import {node.module} in {path}")
    return violations
