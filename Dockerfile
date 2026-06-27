# ──────────────────────────────────────────────────────────────
# Single-image build (Task A7). Place this file at the REPO ROOT,
# next to backend/ and frontend/.
# React is compiled by Node, then served by Django via
# Gunicorn + WhiteNoise — one image, one container.
# ──────────────────────────────────────────────────────────────

# ---- Stage 1: build the React frontend ----
FROM node:20-alpine AS frontend
WORKDIR /frontend

# Vite bakes VITE_* vars into the bundle at BUILD time, so the backend URL
# must be supplied here via: docker build --build-arg VITE_BACKEND_BASE_URL=...
ARG VITE_BACKEND_BASE_URL
ENV VITE_BACKEND_BASE_URL=$VITE_BACKEND_BASE_URL

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
# This project uses Vite, which outputs to /frontend/dist.
RUN npm run build

# ---- Stage 2: Django backend ----
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # The folder next to settings.py that contains wsgi.py.
    # e.g. backend/sashc/wsgi.py  ->  "sashc.wsgi"
    DJANGO_WSGI_MODULE=sashc.wsgi

WORKDIR /app

# Build tools for psycopg2 (drop libpq-dev if you only use SQLite)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies. gunicorn + whitenoise are added here so they
# don't have to be in requirements.txt.
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn whitenoise

# Django source code
COPY backend/ ./

# Bring the compiled React app in so collectstatic / WhiteNoise serve it.
# Vite outputs to dist/.
COPY --from=frontend /frontend/dist ./frontend_build

# Application port (Task A7). Gunicorn binds to 8000 below.
EXPOSE 8000

# Start command: apply migrations -> collect static files -> run Gunicorn.
CMD python manage.py migrate --noinput && \
    python manage.py collectstatic --noinput && \
    gunicorn ${DJANGO_WSGI_MODULE}:application --bind 0.0.0.0:8000 --workers 3