"""One-way, read-only telemetry bus from the trust kernel to the operations plane (L5).

The kernel publishes; the dashboard and the AI ops plane can only read copies. Nothing here
flows back into detection. TODO(backend): swap for Redis Streams with a read-only ACL user.
"""

from __future__ import annotations

import copy
import threading
import time
from collections import deque


class TelemetryBus:
    def __init__(self, maxlen: int = 5000):
        self._events: deque[dict] = deque(maxlen=maxlen)
        self._seq = 0
        self._lock = threading.Lock()

    def publish(self, kind: str, data: dict) -> None:
        with self._lock:
            self._seq += 1
            self._events.append({"seq": self._seq, "ts": time.time(), "kind": kind, "data": data})

    def read(self, since: int = 0) -> list[dict]:
        with self._lock:
            return [copy.deepcopy(e) for e in self._events if e["seq"] > since]
