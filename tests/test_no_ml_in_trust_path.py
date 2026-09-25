"""NFR-1: no decision in the verification trust path may depend on a learned model.

Two independent guards (plus `lint-imports` in CI):
  1. static: AST-scan every module of the trust kernel for forbidden imports
  2. runtime: importing and running the kernel must not load any ML library
"""

import ast
import subprocess
import sys
from pathlib import Path

TRUST_KERNEL = ["quantum", "qds", "detect"]
FORBIDDEN = {"sklearn", "torch", "tensorflow", "keras", "xgboost", "lightgbm", "prophet",
             "optuna", "transformers", "anthropic", "openai", "qsentinel_ops", "joblib", "onnx",
             "onnxruntime"}
# Model-artefact loaders: forbidden to import in kernel code (stdlib, so static check only).
STATIC_ONLY = {"pickle", "dill", "cloudpickle"}
ROOT = Path(__file__).resolve().parents[1] / "qsentinel"


def _imports(path: Path):
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            yield from (a.name.split(".")[0] for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            yield node.module.split(".")[0]
        elif isinstance(node, ast.Call) and getattr(node.func, "attr", "") == "import_module":
            yield "<dynamic import_module>"
        elif isinstance(node, ast.Call) and getattr(node.func, "id", "") == "__import__":
            yield "<dynamic __import__>"


def test_trust_kernel_has_no_ml_imports():
    offenders = []
    for pkg in TRUST_KERNEL:
        for f in (ROOT / pkg).rglob("*.py"):
            bad = [m for m in _imports(f)
                   if m in FORBIDDEN | STATIC_ONLY or m.startswith("<dynamic")]
            if bad:
                offenders.append(f"{f.relative_to(ROOT)}: {bad}")
    assert not offenders, "AI/ML leaked into the trust path:\n" + "\n".join(offenders)


def test_running_kernel_loads_no_ml_modules():
    code = (
        "import sys\n"
        "from qsentinel.config import FAST\n"
        "from qsentinel.pipeline import QSentinel\n"
        "from qsentinel.attacks import run_attack\n"
        "run_attack(QSentinel(settings=FAST), 'intercept_resend', seed=1)\n"
        f"bad = sorted(m for m in sys.modules if m.split('.')[0] in {sorted(FORBIDDEN)!r})\n"
        "print(','.join(bad))\n"
    )
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, check=True)
    assert out.stdout.strip() == "", f"ML modules loaded at runtime: {out.stdout}"
