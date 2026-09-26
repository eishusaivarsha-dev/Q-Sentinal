# Q-SENTINEL, all in one container: the public demo image (Hugging Face Spaces, Render, Koyeb,
# Railway, Fly... anything that runs a Dockerfile and gives it a $PORT).
#
#   docker build -t q-sentinel . && docker run -p 7860:7860 q-sentinel   ->  http://localhost:7860
#
# One port, three processes (deploy/start.sh):
#   nginx            :$PORT  dashboard + reverse proxy   /api/* -> kernel, /ops/* -> ops
#   trust kernel     :8000   qsentinel.api   (its own venv: NO ML library installed, checked below)
#   advisory AI      :8100   qsentinel_ops   (its own venv: scikit-learn, Anthropic SDK)
# Separate processes AND separate environments, so the "no AI in the trust path" rule (NFR-1)
# still holds here. docker-compose.yml runs the same pieces as separate containers.

FROM node:20-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
ENV VITE_API_URL=/api VITE_OPS_URL=/ops
RUN npm run build

FROM python:3.11-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends nginx gettext-base \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Trust kernel: its own virtual environment, and the build fails if an ML library sneaks in.
COPY pyproject.toml README.md ./
COPY qsentinel ./qsentinel
RUN python -m venv /opt/kernel \
 && /opt/kernel/bin/pip install --no-cache-dir . \
 && /opt/kernel/bin/python -c "import importlib.util as u, sys; sys.exit(any(u.find_spec(m) for m in ('sklearn','torch','tensorflow','anthropic')))"

# Advisory AI plane: a different virtual environment. It never imports qsentinel.
COPY ops ./ops
RUN python -m venv /opt/ops && /opt/ops/bin/pip install --no-cache-dir "./ops[llm]"

COPY --from=web /web/dist /srv/www
COPY deploy/nginx.single.conf.template deploy/start.sh ./deploy/

# Hugging Face Spaces runs the container as uid 1000; nginx writes only under /tmp.
RUN useradd -m -u 1000 sentinel 2>/dev/null || true
USER 1000
ENV PORT=7860 QSENTINEL_PROFILE=fast QSENTINEL_DEMO_SEED=1 PYTHONUNBUFFERED=1
EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD python -c "import urllib.request,os; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"7860\")}/api/health')"
CMD ["sh", "/app/deploy/start.sh"]
