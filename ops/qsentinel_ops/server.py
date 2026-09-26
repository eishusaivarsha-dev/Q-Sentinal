"""Advisory ops-plane HTTP service for the dashboard's Ops page (the project's AI layer).

It reads the core API's telemetry (read-only) and serves:
    GET  /incidents        alert storms clustered into incidents (DBSCAN) + plain-language summaries
    GET  /forecast         per-link QBER / CHSH projection and time-to-threshold (Holt smoothing)
    GET  /anomalies        least typical verifications (Isolation Forest)
    GET  /fraud/queue      fraud review queue: risk score, reasons, recommended disposition
    GET  /fraud/cases/{i}  the fraud assessment of one verdict (the analyst decides in the console;
                           the decision goes to the KERNEL, POST /reviews/{i}, not here)
    GET  /copilot/status   which copilot is answering: Claude (ANTHROPIC_API_KEY set) or offline
    GET  /copilot/brief    the exact read-only data the copilot sees
    POST /copilot/chat     Sentinel Copilot answer, streamed as server-sent events

It never talks back to the core API's write endpoints and is never consulted for a verdict.
Every response carries ADVISORY_LABEL.

    pip install -e "ops[llm]"
    uvicorn qsentinel_ops.server:app --port 8100

Env: QSENTINEL_API_URL (default http://localhost:8000), QSENTINEL_OPS_KEY (an analyst key, only
when the core API has QSENTINEL_API_KEYS set), CORS_ORIGINS, ANTHROPIC_API_KEY and
QSENTINEL_LLM_MODEL (copilot), COPILOT_RATE (questions per client per 10 minutes, default 30).
"""

from __future__ import annotations

import json
import os
import time
from collections import defaultdict, deque

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import ADVISORY_LABEL, copilot, fraud
from .anomaly import fetch_all_verdicts, rank
from .clustering import cluster, fetch_verdicts
from .forecast import fetch_links, forecast_all
from .narration import narrate_incident

API = os.getenv("QSENTINEL_API_URL", "http://localhost:8000")
KEY = os.getenv("QSENTINEL_OPS_KEY")
RATE = int(os.getenv("COPILOT_RATE", "30"))
DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"

app = FastAPI(title="Q-SENTINEL ops plane (advisory)", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", DEFAULT_ORIGINS).split(","),
                   allow_methods=["GET", "POST"], allow_headers=["*"])


def _core(fn, *args):
    try:
        return fn(API, KEY, *args)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"core API unreachable at {API}: {e}") from e


@app.get("/health")
def health():
    return {"status": "ok", "label": ADVISORY_LABEL, "api": API, "copilot": copilot.mode(),
            "model": copilot.model() if copilot.mode() == "claude" else None}


@app.get("/incidents")
def incidents(eps: float = 1.0):
    result = cluster(_core(fetch_verdicts), eps)
    for inc in result["incidents"]:
        inc["narrative"] = narrate_incident(inc)
    return result


@app.get("/forecast")
def forecast(horizon: int = 10):
    return forecast_all(_core(fetch_links), max(3, min(horizon, 30)))


@app.get("/anomalies")
def anomalies(top: int = 8):
    return rank(_core(fetch_all_verdicts), max(1, min(top, 20)))


@app.get("/fraud/queue")
def fraud_queue(min_risk: int = 25, limit: int = 30, open_only: bool = False):
    ctx = _core(fraud.context)
    return fraud.queue(ctx, max(0, min(min_risk, 100)), max(1, min(limit, 200)), include_reviewed=not open_only)


@app.get("/fraud/cases/{ledger_index}")
def fraud_case(ledger_index: int):
    c = fraud.case(_core(fraud.context), ledger_index)
    if c is None:
        raise HTTPException(404, "no verification with that ledger index in the telemetry")
    return c


@app.get("/copilot/status")
def copilot_status():
    m = copilot.mode()
    return {"label": ADVISORY_LABEL, "mode": m, "model": copilot.model() if m == "claude" else "offline analyst"}


@app.get("/copilot/brief")
def copilot_brief():
    return {"label": ADVISORY_LABEL, "brief": _brief("")}


def _brief(question: str) -> dict:
    try:
        return copilot.build_brief(API, KEY, question)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"core API unreachable at {API}: {e}") from e


class ChatIn(BaseModel):
    question: str = Field(..., min_length=1, max_length=1200)
    history: list[dict] = Field(default_factory=list, max_length=16)


_hits: dict[str, deque] = defaultdict(deque)


def _rate_limit(client: str) -> None:
    now, q = time.time(), _hits[client]
    while q and now - q[0] > 600:
        q.popleft()
    if len(q) >= RATE:
        raise HTTPException(429, "Copilot question limit reached; try again in a few minutes.")
    q.append(now)


def _sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@app.post("/copilot/chat")
def copilot_chat(body: ChatIn, request: Request):
    _rate_limit(request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0])
    brief = _brief(body.question)
    live = copilot.mode() == "claude"

    def events():
        yield _sse("meta", {"label": ADVISORY_LABEL, "mode": copilot.mode(),
                            "model": copilot.model() if live else "offline analyst"})
        try:
            for chunk in copilot.answer_stream(body.question, body.history, brief):
                yield _sse("delta", {"text": chunk})
                if not live:
                    time.sleep(0.012)
        except Exception as e:  # noqa: BLE001 - a failed model call must not break the page
            yield _sse("delta", {"text": f"\n\n(The model could not answer: {type(e).__name__}. "
                                         "Falling back to the offline analyst.)\n\n"})
            for chunk in copilot.offline_answer(body.question, brief).split(" "):
                yield _sse("delta", {"text": chunk + " "})
        yield _sse("done", {})

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
