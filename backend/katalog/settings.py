import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY   = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-CHANGE-IN-PRODUCTION-abc123xyz')
DEBUG        = os.environ.get('DEBUG', 'True') == 'True'
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'channels',
    'django_filters',
    'apps.core',
    'apps.catalog',
    'apps.orders',
    'apps.technicians',
    'apps.analytics',
    'apps.superadmin',
]

AUTH_USER_MODEL = 'core.User'

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF   = 'katalog.urls'
WSGI_APPLICATION = 'katalog.wsgi.application'
ASGI_APPLICATION = 'katalog.asgi.application'

TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates','DIRS': [],'APP_DIRS': True,'OPTIONS': {'context_processors': ['django.template.context_processors.debug','django.template.context_processors.request','django.contrib.auth.context_processors.auth','django.contrib.messages.context_processors.messages']}}]

DATABASES = {'default': {
    'ENGINE':   'django.db.backends.postgresql',
    'NAME':     os.environ.get('DB_NAME',     'katalog'),
    'USER':     os.environ.get('DB_USER',     'katalog_user'),
    'PASSWORD': os.environ.get('DB_PASSWORD', 'changeme'),
    'HOST':     os.environ.get('DB_HOST',     'localhost'),
    'PORT':     os.environ.get('DB_PORT',     '5432'),
    'OPTIONS':  {'connect_timeout': 10},
}}

REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

CACHES = {'default': {
    'BACKEND': 'django_redis.cache.RedisCache',
    'LOCATION': REDIS_URL,
    'OPTIONS': {'CLIENT_CLASS': 'django_redis.client.DefaultClient'},
    'TIMEOUT': 300,
}}

CHANNEL_LAYERS = {'default': {
    'BACKEND': 'channels_redis.core.RedisChannelLayer',
    'CONFIG':  {'hosts': [REDIS_URL]},
}}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework_simplejwt.authentication.JWTAuthentication'],
    'DEFAULT_PERMISSION_CLASSES':     ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_PAGINATION_CLASS':       'apps.core.pagination.StandardPagination',
    'EXCEPTION_HANDLER':              'apps.core.exceptions.custom_exception_handler',
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_THROTTLE_CLASSES':  ['rest_framework.throttling.AnonRateThrottle','rest_framework.throttling.UserRateThrottle'],
    'DEFAULT_THROTTLE_RATES':    {'anon': '200/hour', 'user': '2000/hour', 'login': '5/min'},
    'DEFAULT_RENDERER_CLASSES':  ['rest_framework.renderers.JSONRenderer'],
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':   timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME':  timedelta(days=7),
    'ROTATE_REFRESH_TOKENS':   True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM':   'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

CORS_ALLOWED_ORIGINS  = os.environ.get('CORS_ORIGINS','http://localhost:3000').split(',')
CORS_ALLOW_CREDENTIALS = True

STATIC_URL   = '/static/'
STATIC_ROOT  = BASE_DIR / 'staticfiles'
MEDIA_URL    = '/media/'
MEDIA_ROOT   = BASE_DIR / 'media'

DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

STRIPE_SECRET_KEY     = os.environ.get('STRIPE_SECRET_KEY', '')
STRIPE_PUBLIC_KEY     = os.environ.get('STRIPE_PUBLIC_KEY', '')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')

TNS_API_URL     = os.environ.get('TNS_API_URL', '')
TNS_API_KEY     = os.environ.get('TNS_API_KEY', '')
TNS_HMAC_SECRET = os.environ.get('TNS_HMAC_SECRET', '')

FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

EMAIL_BACKEND       = 'django.core.mail.backends.console.EmailBackend' if DEBUG else 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST          = os.environ.get('EMAIL_HOST', 'smtp.resend.com')
EMAIL_PORT          = int(os.environ.get('EMAIL_PORT', '465'))
EMAIL_USE_SSL       = True
EMAIL_HOST_USER     = os.environ.get('EMAIL_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_PASSWORD', '')
DEFAULT_FROM_EMAIL  = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@katalog.com')

CELERY_BROKER_URL      = os.environ.get('CELERY_BROKER_URL',    REDIS_URL)
CELERY_RESULT_BACKEND  = os.environ.get('CELERY_RESULT_BACKEND', REDIS_URL)
CELERY_ACCEPT_CONTENT  = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_TIMEZONE        = 'America/Bogota'

if not DEBUG:
    SECURE_HSTS_SECONDS            = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_SSL_REDIRECT            = True
    SESSION_COOKIE_SECURE          = True
    CSRF_COOKIE_SECURE             = True

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {'verbose': {'format': '{levelname} {asctime} [{name}] {message}', 'style': '{'}},
    'handlers':   {'console': {'class': 'logging.StreamHandler', 'formatter': 'verbose'}},
    'loggers': {
        'django':  {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
        'katalog': {'handlers': ['console'], 'level': 'INFO',    'propagate': False},
        'apps':    {'handlers': ['console'], 'level': 'INFO',    'propagate': False},
    },
    'root': {'handlers': ['console'], 'level': 'WARNING'},
}

LANGUAGE_CODE = 'es-co'
TIME_ZONE     = 'America/Bogota'
USE_I18N      = True
USE_TZ        = True
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 12}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
]

# ══════════════════════════════════════════════════════════════════════════
# PRODUCTION HARDENING — añadido en auditoría
# ══════════════════════════════════════════════════════════════════════════

# ── DB connection pooling — CRÍTICO para 1000 usuarios ────────────────────
DATABASES['default']['CONN_MAX_AGE'] = 60          # Reusar conexiones 60s
DATABASES['default']['CONN_HEALTH_CHECKS'] = True  # Verificar antes de reusar
DATABASES['default']['OPTIONS']['options'] = '-c default_transaction_isolation=read committed'

# ── Transacciones atómicas por request — evita deadlocks ──────────────────
# ATOMIC_REQUESTS se activa solo en producción para no romper tests
if not DEBUG:
    DATABASES['default']['ATOMIC_REQUESTS'] = True

# ── Argon2 password hasher — más seguro que PBKDF2 ────────────────────────
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',  # fallback legacy
]

# ── Sesiones en Redis (no en DB) — escala horizontal ─────────────────────
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'
SESSION_COOKIE_AGE  = 86400 * 7   # 7 días
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'

# ── File upload security ──────────────────────────────────────────────────
ALLOWED_IMAGE_TYPES = ['image/jpeg','image/png','image/webp']
FILE_UPLOAD_MAX_MEMORY_SIZE    = 5 * 1024 * 1024   # 5 MB
DATA_UPLOAD_MAX_MEMORY_SIZE    = 5 * 1024 * 1024
DATA_UPLOAD_MAX_NUMBER_FIELDS  = 100

# ── Rate limiting granular en DRF ─────────────────────────────────────────
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].update({
    'anon':             '60/min',
    'user':             '300/min',
    'login':            '5/min',
    'analytics_public': '120/min',
    'order_create':     '10/min',
    'search':           '60/min',
})

# ── Cache extra para rate limiting (DB3 Redis separado de sesiones) ────────
CACHES['rate_limit'] = {
    'BACKEND': 'django_redis.cache.RedisCache',
    'LOCATION': os.environ.get('REDIS_URL', 'redis://localhost:6379/1').replace('/0','/1'),
    'OPTIONS': {'CLIENT_CLASS': 'django_redis.client.DefaultClient'},
    'TIMEOUT': 60,
}

# ── Security headers adicionales ──────────────────────────────────────────
SECURE_REFERRER_POLICY     = 'strict-origin-when-cross-origin'
SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin'
PERMISSIONS_POLICY = {
    'camera':       [],
    'microphone':   [],
    'geolocation':  [],
}

# ── Logging extra para auditoría ─────────────────────────────────────────
LOGGING['loggers']['django.security'] = {'handlers': ['console'], 'level': 'WARNING', 'propagate': False}
LOGGING['loggers']['django.request']  = {'handlers': ['console'], 'level': 'WARNING', 'propagate': False}

# ══════════════════════════════════════════════════════════════════════════════
# ENTERPRISE ADDITIONS — Sentry, Prometheus, S3, MFA, Logging JSON
# ══════════════════════════════════════════════════════════════════════════════

# ── Sentry error tracking ──────────────────────────────────────────────────
SENTRY_DSN = os.environ.get('SENTRY_DSN', '')
if SENTRY_DSN and not DEBUG:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.redis import RedisIntegration
    sentry_sdk.init(
        dsn              = SENTRY_DSN,
        integrations     = [DjangoIntegration(), CeleryIntegration(), RedisIntegration()],
        traces_sample_rate = 0.1,    # 10% de requests trackeados
        profiles_sample_rate = 0.1,
        send_default_pii = False,    # No enviar datos personales a Sentry
        environment      = 'production',
    )

# ── Prometheus metrics ─────────────────────────────────────────────────────
PROMETHEUS_EXPORT_MIGRATIONS = False
if 'django_prometheus' not in INSTALLED_APPS:
    INSTALLED_APPS.insert(0, 'django_prometheus')
    MIDDLEWARE.insert(0, 'django_prometheus.middleware.PrometheusBeforeMiddleware')
    MIDDLEWARE.append('django_prometheus.middleware.PrometheusAfterMiddleware')

# ── S3 Media Storage (escala horizontal — no /media/ local) ────────────────
AWS_ACCESS_KEY_ID      = os.environ.get('AWS_ACCESS_KEY_ID', '')
AWS_SECRET_ACCESS_KEY  = os.environ.get('AWS_SECRET_ACCESS_KEY', '')
AWS_STORAGE_BUCKET     = os.environ.get('AWS_STORAGE_BUCKET', '')
AWS_S3_REGION          = os.environ.get('AWS_S3_REGION', 'us-east-1')
AWS_S3_CUSTOM_DOMAIN   = os.environ.get('AWS_CLOUDFRONT_DOMAIN', '')  # CDN
AWS_S3_FILE_OVERWRITE  = False
AWS_DEFAULT_ACL        = 'private'
AWS_S3_OBJECT_PARAMETERS = {'CacheControl': 'max-age=86400'}

if AWS_STORAGE_BUCKET and not DEBUG:
    DEFAULT_FILE_STORAGE  = 'storages.backends.s3boto3.S3Boto3Storage'
    MEDIA_URL             = f'https://{AWS_S3_CUSTOM_DOMAIN or f"{AWS_STORAGE_BUCKET}.s3.amazonaws.com"}/'

# ── MFA: TOTP para admin/superadmin ───────────────────────────────────────
MFA_REQUIRED_ROLES = ['admin', 'superadmin']
MFA_TOTP_ISSUER    = os.environ.get('SITE_NAME', 'Katalog Enterprise')

# ── Account lockout temporal (auto-unlock tras 15 min) ────────────────────
LOGIN_MAX_ATTEMPTS  = 5
LOGIN_LOCKOUT_SECS  = 900   # 15 minutos

# ── Cache per-view para catálogo público ──────────────────────────────────
CACHE_MIDDLEWARE_SECONDS = 60
CACHE_MIDDLEWARE_KEY_PREFIX = 'katalog'

# ── Structured JSON logging para ELK/Datadog ──────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {
            '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(name)s %(levelname)s %(message)s %(pathname)s %(lineno)d',
        },
        'verbose': {
            'format': '{levelname} {asctime} [{name}] {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json' if not DEBUG else 'verbose',
        },
    },
    'loggers': {
        'django':          {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
        'django.security': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
        'django.request':  {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
        'katalog':         {'handlers': ['console'], 'level': 'INFO',    'propagate': False},
        'apps':            {'handlers': ['console'], 'level': 'INFO',    'propagate': False},
        'celery':          {'handlers': ['console'], 'level': 'INFO',    'propagate': False},
    },
    'root': {'handlers': ['console'], 'level': 'WARNING'},
}

# ── Celery queues separadas por prioridad ─────────────────────────────────
CELERY_TASK_ROUTES = {
    'apps.analytics.tasks.*':   {'queue': 'analytics'},
    'apps.catalog.tasks.*':     {'queue': 'celery'},
    'apps.orders.tasks.*':      {'queue': 'default'},
}
CELERY_TASK_SERIALIZER     = 'json'
CELERY_RESULT_SERIALIZER   = 'json'
CELERY_TASK_TRACK_STARTED  = True
CELERY_TASK_SEND_SENT_EVENT = True

# ── Database Router for Read Replica ──────────────────────────────────────
# Add replica in production via env DB_REPLICA_HOST
DB_REPLICA_HOST = os.environ.get('DB_REPLICA_HOST', '')
if DB_REPLICA_HOST:
    DATABASES['replica'] = {
        'ENGINE':   'django.db.backends.postgresql',
        'NAME':     os.environ.get('DB_NAME',     'katalog'),
        'USER':     os.environ.get('DB_USER',     'katalog_user'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'changeme'),
        'HOST':     DB_REPLICA_HOST,
        'PORT':     os.environ.get('DB_PORT', '5432'),
        'OPTIONS':  {'connect_timeout': 10},
        'CONN_MAX_AGE': 60,
        'TEST': {'MIRROR': 'default'},
    }
    DATABASE_ROUTERS = ['katalog.db_router.AnalyticsReadRouter']


# ── Rate limiting extra per user ──────────────────────────────────────────
REST_FRAMEWORK.setdefault('DEFAULT_THROTTLE_RATES', {})
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].update({
    'order_create':     '10/min',
    'analytics_public': '120/min',
    'search':           '60/min',
    'login':            '5/min',
})
