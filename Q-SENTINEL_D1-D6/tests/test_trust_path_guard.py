from pathlib import Path
from qsentinel.detect.ci_guard import scan_detect_tree


def test_no_ml_in_trust_path():
    root = Path(__file__).resolve().parents[1] / "qsentinel" / "detect"
    assert scan_detect_tree(root) == []
