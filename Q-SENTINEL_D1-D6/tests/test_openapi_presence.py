from pathlib import Path


def test_openapi_exists():
    root = Path(__file__).resolve().parents[1]
    assert (root / "openapi.yaml").exists()
