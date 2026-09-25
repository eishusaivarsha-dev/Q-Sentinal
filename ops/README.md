# qsentinel-ops: AI operations plane (L5, Phase 4)

This package is **advisory only**. It is a separate installable package with its own dependencies, and it **never imports `qsentinel`**. It reads telemetry through the API, so it has no way to influence an accept/reject verdict.

| Module | What it does | Status |
|---|---|---|
| `clustering.py` | DBSCAN over alert events to group an alert storm into incidents | starter |
| `narration.py` | LLM incident summaries built from proof certificates | stub |
| *(todo)* `forecast.py` | Prophet/ARIMA forecast of detector drift | todo |
| *(todo)* `fuzz.py` | Hypothesis/Atheris search for new attack parameters for L4 | todo |
| *(todo)* `threshold_study.py` | Optuna offline study; the deployed threshold stays the proven constant | todo |

```bash
pip install -e ops
python -m qsentinel_ops.clustering --api http://localhost:8000
```
