"""
Django settings for SASHC Production / Render deployment.

Set the environment variable DJANGO_SETTINGS_MODULE=sashc.deployment_settings
in your Render service settings to use this file.

Required environment variables on Render:
  SECRET_KEY                Django secret key
  RENDER_EXTERNAL_HOSTNAME  Automatically set by Render (e.g. sashc-backend.onrender.com)
  DATABASE_URL              Automatically set by Render PostgreSQL add-on
  BREVO_API_KEY             Brevo API key (from brevo.com → SMTP & API)
  DEFAULT_FROM_EMAIL        Sender address (e.g. SASHC <yourname@gmail.com>)
  CORS_ALLOWED_ORIGINS      Frontend URL (e.g. https://sashc.onrender.com)
  FRONTEND_URL              Frontend base URL for password-reset links
"""

import os
import dj_database_url

from .settings import *

SECRET_KEY = os.environ.get('SECRET_KEY')

# Override SIMPLE_JWT signing key to use the production SECRET_KEY
# (settings.py sets SIGNING_KEY at import time with the default empty key)
SIMPLE_JWT = {
    **SIMPLE_JWT,
    'SIGNING_KEY': SECRET_KEY,
}

DEBUG = False

ALLOWED_HOSTS = [os.environ.get('RENDER_EXTERNAL_HOSTNAME')]

CSRF_TRUSTED_ORIGINS = ['https://' + os.environ.get('RENDER_EXTERNAL_HOSTNAME')]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

CORS_ALLOWED_ORIGINS = [os.environ.get('CORS_ALLOWED_ORIGINS')]

# Database – Neon PostgreSQL via DATABASE_URL
DATABASES = {
    'default': dj_database_url.config(
        default=os.environ['DATABASE_URL'],
        conn_max_age=60,
        ssl_require=True,
    )
}

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

# Security hardening
SECURE_HSTS_SECONDS = 31536000          # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

ANYMAIL = {
    "BREVO_API_KEY": os.environ.get("BREVO_API_KEY"),
}
EMAIL_BACKEND = "anymail.backends.brevo.EmailBackend"
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL")

FRONTEND_URL = os.environ.get('FRONTEND_URL')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'sashcapp': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'django': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}
