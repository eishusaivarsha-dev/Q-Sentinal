"""Advisory ops-plane HTTP service for the dashboard's Ops page.

It reads the core API's telemetry (read-only) and returns alert clusters with plain-language
summaries. It never talks back to the core API's write endpoints and is never consulted for a
verdict. Every response carries ADVISORY_LABEL.

    pip install -e ops
    uvicorn qsentinel_ops.server:app --port 8100

Env: QSENTINEL_API_URL (default http://localhost:8000), QSENTINEL_OPS_KEY (an analyst key, only
when the core API has QSENTINEL_API_KEYS set), CORS_ORIGINS.
"""

from __future__ import annotations

import os

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import ADVISORY_LABEL
from .clustering import cluster, fetch_verdicts
from .narration import narrate_incident

API = os.getenv("QSENTINEL_API_URL", "http://localhost:8000")
KEY = os.getenv("QSENTINEL_OPS_KEY")
DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"

app = FastAPI(title="Q-SENTINEL ops plane (advisory)", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", DEFAULT_ORIGINS).split(","),
                   allow_methods=["GET"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"status": "ok", "label": ADVISORY_LABEL, "api": API}


@app.get("/incidents")
def incidents(eps: float = 1.0):
    try:
        events = fetch_verdicts(API, KEY)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"core API unreachable at {API}: {e}") from e
    result = cluster(events, eps)
    for inc in result["incidents"]:
        inc["narrative"] = narrate_incident(inc)
    return result
