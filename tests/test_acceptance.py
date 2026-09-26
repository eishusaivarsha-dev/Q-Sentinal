"""The D1-D6 acceptance criteria (from the D1-D6 workstream) hold for the integrated system."""

from qsentinel import acceptance


def test_quick_acceptance_report_passes():
    rep = acceptance.run()
    failed = [c["id"] for c in rep["checks"] if not c["passed"]]
    assert not failed, failed
