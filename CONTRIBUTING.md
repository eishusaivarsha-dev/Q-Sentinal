# Contributing

## One-time setup
1. Accept the GitHub invite (check your email or https://github.com/notifications).
2. Clone the repo and install:
   ```bash
   git clone https://github.com/<owner>/q-sentinel.git
   cd q-sentinel
   python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -e ".[dev]"
   pytest
   ```
3. Frontend people also run: `cd web && npm install && npm run dev`

## Daily workflow
1. Pick or create an issue, and assign it to yourself.
2. Branch from `main` using your area as the prefix:
   `quantum/measure-on-receipt`, `detect/basis-fingerprint`, `security/entangle-measure`,
   `chain/merkle-batch`, `web/bloch-live`, `infra/redis-bus`
3. Make small commits. Push, then open a PR into `main` (the template has a checklist).
4. CI must be green, and one teammate must approve (the folder owner if possible).
5. Merge with **Squash and merge**. Delete the branch.

```bash
git switch main && git pull
git switch -c quantum/my-feature
# ...work...
pytest && ruff check .
git add -A && git commit -m "quantum: add measure-on-receipt mode"
git push -u origin quantum/my-feature
```

## House rules
- **Never push directly to `main`.**
- **No AI/ML inside `qsentinel/quantum`, `qsentinel/qds` or `qsentinel/detect`.** CI fails if you try. ML belongs in `ops/` only.
- Every detector rule must be closed-form, with its error bound written in the docstring.
- Every attack must be seed-reproducible and must declare which detector catches it.
- Never commit secrets (IBM token, API keys, `.env`). Use `.env.example` as the template.
- Put the owner in the TODO when you leave one: `# TODO(detection-lead): ...`
