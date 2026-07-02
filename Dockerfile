# ──────────────────────────────────────────────────────────────
# Single-image build (Task A7). Lives at the REPO ROOT, next to
# backend/ and frontend/.
# React is compiled by Node, then Django serves the API (and the
# baked static assets via WhiteNoise) under Gunicorn — one image,
# one container.
# ──────────────────────────────────────────────────────────────

# ---- Stage 1: build the React frontend ----
FROM node:20-alpine AS frontend
WORKDIR /frontend

# Install deps first for better layer caching. Use `npm ci` when a
# lockfile is present (deterministic), else fall back to `npm install`.
COPY frontend/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# COPY brings in the frontend source (and frontend/.env, materialised
# from the Jenkins 'frontend-env' secret at checkout). Vite auto-loads
# .env and bakes the VITE_* vars into the bundle. Host node_modules /
# dist are excluded via .dockerignore so they can't clobber this stage.
COPY frontend/ ./

# Serve the bundle under /static/ so Django + WhiteNoise can host it in the
# single image. vite.config.js reads VITE_BASE (defaults to '/' elsewhere).
ARG VITE_BASE=/static/
ENV VITE_BASE=$VITE_BASE
RUN npm run build

# ---- Stage 2: Django backend ----
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # The package next to settings.py that contains wsgi.py.
    # e.g. backend/sashc/wsgi.py  ->  "sashc.wsgi"
    DJANGO_WSGI_MODULE=sashc.wsgi

WORKDIR /app

# Build tools for psycopg2 / scientific wheels. libpq-dev is needed by
# psycopg2-binary's build path; the rest cover numpy/scipy/scikit-learn.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies. gunicorn + whitenoise are already pinned in
# requirements.txt, so a plain install is enough.
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Django source code (includes backend/.env when Jenkins materialises it).
COPY backend/ ./

# Bring the compiled React app in. Vite outputs to dist/.
COPY --from=frontend /frontend/dist ./frontend_build

# Entrypoint: collectstatic -> migrate (if DB set) -> gunicorn.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Strip any CRLF (repo is edited on Windows) so the shebang works, then chmod.
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

# Application port (Task A7). Gunicorn binds to 8000.
EXPOSE 8000

ENTRYPOINT ["docker-entrypoint.sh"]
