"""Telemetry bus and its optional Redis Streams mirror. Author: Shubham Kumar."""

import json

from qsentinel.config import FAST
from qsentinel.pipeline import QSentinel
from qsentinel.telemetry import DEFAULT_STREAM, TelemetryBus


class FakeRedis:
    def __init__(self, fail: bool = False):
        self.fail = fail
        self.calls: list[tuple] = []

    def xadd(self, stream, fields, maxlen=None, approximate=True):
        if self.fail:
            raise ConnectionError("redis down")
        self.calls.append((stream, fields, maxlen))


def test_in_memory_bus_without_redis(monkeypatch):
    monkeypatch.delenv("QSENTINEL_REDIS_URL", raising=False)
    bus = TelemetryBus()
    bus.publish("verdict", {"decision": "ACCEPT"})
    bus.publish("verdict", {"decision": "REJECT"})
    assert not bus.mirror_enabled
    assert [e["seq"] for e in bus.read()] == [1, 2]
    assert [e["seq"] for e in bus.read(since=1)] == [2]


def test_read_returns_copies():
    bus = TelemetryBus(redis_client=FakeRedis())
    bus.publish("verdict", {"decision": "ACCEPT"})
    bus.read()[0]["data"]["decision"] = "TAMPERED"
    assert bus.read()[0]["data"]["decision"] == "ACCEPT"


def test_events_mirrored_to_stream_in_order():
    fake = FakeRedis()
    bus = TelemetryBus(maxlen=100, redis_client=fake)
    bus.publish("key_issued", {"key_id": "k1"})
    bus.publish("verdict", {"decision": "REJECT"})
    assert [c[0] for c in fake.calls] == [DEFAULT_STREAM] * 2
    assert all(c[2] == 100 for c in fake.calls)
    events = [json.loads(c[1]["event"]) for c in fake.calls]
    assert [e["seq"] for e in events] == [1, 2]
    assert events == bus.read()


def test_redis_failure_never_breaks_publish():
    bus = TelemetryBus(redis_client=FakeRedis(fail=True))
    bus.publish("verdict", {"decision": "ACCEPT"})
    bus.publish("verdict", {"decision": "ACCEPT"})     # inside the back-off window: not retried
    assert len(bus.read()) == 2
    assert bus.mirror_errors == 1


def test_pipeline_verdicts_reach_the_mirror():
    fake = FakeRedis()
    env = QSentinel(settings=FAST, telemetry=TelemetryBus(redis_client=fake))
    env.register_signer("alice")
    env.register_verifier("bob")
    sig = env.sign("alice", b"transfer 10 QSC", seed=1)
    env.verify(sig, "bob", seed=2)
    kinds = [json.loads(c[1]["event"])["kind"] for c in fake.calls]
    assert "key_issued" in kinds and "verdict" in kinds
