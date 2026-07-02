#!/usr/bin/env sh
# ──────────────────────────────────────────────────────────────
# Container start-up: collect static -> migrate (if a DB is set)
# -> launch Gunicorn. Kept resilient so the image can boot for a
# smoke test even before DATABASE_URL is wired in.
# ──────────────────────────────────────────────────────────────
set -e

echo "[entrypoint] Collecting static files..."
python manage.py collectstatic --noinput

# python-decouple reads DATABASE_URL from the environment or backend/.env.
# Only migrate when a database is actually configured; otherwise a bare
# `docker run` (no DB) would crash instead of serving.
if [ -n "${DATABASE_URL:-}" ] || grep -qs '^DATABASE_URL=' .env 2>/dev/null; then
    echo "[entrypoint] Applying database migrations..."
    python manage.py migrate --noinput
else
    echo "[entrypoint] DATABASE_URL not set - skipping migrations."
fi

echo "[entrypoint] Starting Gunicorn on 0.0.0.0:${PORT:-8000}..."
exec gunicorn "${DJANGO_WSGI_MODULE}:application" \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers "${GUNICORN_WORKERS:-3}" \
    --access-logfile - \
    --error-logfile -
