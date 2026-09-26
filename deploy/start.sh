#!/bin/sh
# Entry point of the all-in-one image (Dockerfile at the repo root). See the comments there.
set -e
PORT="${PORT:-7860}"
export PORT

/opt/kernel/bin/uvicorn qsentinel.api.main:app --host 127.0.0.1 --port 8000 --root-path /api \
  --proxy-headers --forwarded-allow-ips 127.0.0.1 &

QSENTINEL_API_URL=http://127.0.0.1:8000 /opt/ops/bin/uvicorn qsentinel_ops.server:app \
  --host 127.0.0.1 --port 8100 --root-path /ops --proxy-headers --forwarded-allow-ips 127.0.0.1 &

envsubst '${PORT}' < /app/deploy/nginx.single.conf.template > /tmp/nginx.conf
echo "Q-SENTINEL on port ${PORT}: dashboard /, API /api/docs, advisory AI /ops/health"
exec nginx -c /tmp/nginx.conf -e /dev/stderr -g 'daemon off;'
