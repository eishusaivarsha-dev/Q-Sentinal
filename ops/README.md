# qsentinel-ops: AI operations plane (L5)

This package is **advisory only**. It is a separate installable package with its own dependencies, and it **never imports `qsentinel`**. It reads telemetry through the kernel's read-only API, so it has no way to influence an accept/reject verdict. Every response carries `ADVISORY - NOT A TRUST DECISION`.

| Module | What it does |
|---|---|
| `clustering.py` | DBSCAN over alert events: an alert storm becomes a few incidents |
| `narration.py` | Plain-language incident summaries (deterministic template) |
| `anomaly.py` | Isolation Forest over every verdict's physics: the least typical verifications, with the features that drove each score |
| `forecast.py` | Holt smoothing per link: projected QBER / CHSH, an 80% band, verifications until a threshold |
| `fraud.py` | **Fraud review queue.** Combines the detector attribution, ledger disputes, the anomaly score, the signer's failure rate and the link forecast into a 0-100 risk score, a category, plain reasons and a *recommended* disposition (confirm fraud / escalate / monitor / dismiss) |
| `copilot.py` | Sentinel Copilot. With `ANTHROPIC_API_KEY` it answers with Claude (`QSENTINEL_LLM_MODEL`, default `claude-opus-5`, server-side refusal fallback on); without a key an offline analyst answers from the same brief |
| `server.py` | FastAPI on port 8100: `/incidents`, `/forecast`, `/anomalies`, `/fraud/queue`, `/fraud/cases/{i}`, `/copilot/status`, `/copilot/brief`, `/copilot/chat` (SSE), `/health` |

## The AI advises, the analyst decides

The fraud queue only *recommends*. The analyst chooses the disposition in the dashboard's **Fraud Review** page, and the browser sends it to the **kernel** (`POST /reviews/{ledger_index}`), not to this service. The kernel appends it to the ML-DSA-signed ledger as an `analyst_review` entry, together with a snapshot of the AI's recommendation and whether the analyst agreed. The verdict itself is never changed.

```bash
pip install -e "ops[llm]"
uvicorn qsentinel_ops.server:app --port 8100
# optional: export ANTHROPIC_API_KEY=...   (otherwise the offline analyst answers)
```

Env: `QSENTINEL_API_URL` (default `http://localhost:8000`), `QSENTINEL_OPS_KEY` (analyst key when the kernel has `QSENTINEL_API_KEYS`), `CORS_ORIGINS`, `ANTHROPIC_API_KEY`, `QSENTINEL_LLM_MODEL`, `COPILOT_RATE`.
