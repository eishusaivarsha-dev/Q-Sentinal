"""One-way, read-only telemetry bus from the trust kernel to the operations plane (L5).

The kernel publishes; the dashboard and the AI ops plane can only read copies. Nothing here
flows back into detection.

Redis Streams mirror (Shubham Kumar): set QSENTINEL_REDIS_URL (or pass `redis_url`) and every
event is also appended to the stream `qsentinel:telemetry` with XADD, trimmed to `maxlen`. The
in-memory buffer stays the source of truth for `read()`, so the API and tests behave the same
with or without Redis. The mirror can never block or break the kernel: a missing `redis`
package disables it, and a failed write is counted in `mirror_errors` and retried after a
back-off. Consumers should order events by the `seq` field inside each entry.

TODO(team-lead): read-only ACL user for ops/ on the stream (see docs/roles.md).
"""

from __future__ import annotations

import copy
import json
import logging
import os
import threading
import time
from collections import deque

log = logging.getLogger(__name__)

DEFAULT_STREAM = "qsentinel:telemetry"
RETRY_AFTER_S = 30.0


class TelemetryBus:
    def __init__(self, maxlen: int = 5000, redis_url: str | None = None,
                 stream: str = DEFAULT_STREAM, redis_client=None):
        self._events: deque[dict] = deque(maxlen=maxlen)
        self._seq = 0
        self._lock = threading.Lock()
        self._maxlen = maxlen
        self._stream = stream
        self._redis = redis_client
        if redis_url is None:
            redis_url = os.environ.get("QSENTINEL_REDIS_URL") or None
        self._redis_url = redis_url
        self._retry_at = 0.0
        self.mirror_errors = 0

    def publish(self, kind: str, data: dict) -> None:
        with self._lock:
            self._seq += 1
            event = {"seq": self._seq, "ts": time.time(), "kind": kind, "data": data}
            self._events.append(event)
            payload = json.dumps(event, default=str)
        self._mirror(payload)

    def read(self, since: int = 0) -> list[dict]:
        with self._lock:
            return [copy.deepcopy(e) for e in self._events if e["seq"] > since]

    @property
    def mirror_enabled(self) -> bool:
        return self._redis is not None or bool(self._redis_url)

    def _client(self):
        if self._redis is None and self._redis_url:
            try:
                import redis
            except ImportError:
                log.warning("QSENTINEL_REDIS_URL is set but redis is not installed "
                            "(pip install -e .[redis]); telemetry mirror disabled")
                self._redis_url = None
                return None
            self._redis = redis.Redis.from_url(self._redis_url, socket_connect_timeout=0.5,
                                               socket_timeout=0.5)
        return self._redis

    def _mirror(self, payload: str) -> None:
        if not self.mirror_enabled or time.monotonic() < self._retry_at:
            return
        client = self._client()
        if client is None:
            return
        try:
            client.xadd(self._stream, {"event": payload}, maxlen=self._maxlen, approximate=True)
        except Exception as e:  # the mirror must never take the kernel down
            self.mirror_errors += 1
            self._retry_at = time.monotonic() + RETRY_AFTER_S
            log.warning("telemetry mirror write failed (%s); retrying in %.0fs", e, RETRY_AFTER_S)
