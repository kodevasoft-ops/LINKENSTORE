import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'katalog.settings')
app = Celery('katalog')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.beat_schedule = {
    'analytics-daily-summary':          {'task': 'apps.analytics.tasks.compute_daily_summary',    'schedule': crontab(hour=0, minute=5)},
    'analytics-abandonment-recovery':   {'task': 'apps.analytics.tasks.send_abandonment_recovery','schedule': crontab(minute=0, hour='*/2')},
    'analytics-expire-abandonments':    {'task': 'apps.analytics.tasks.expire_old_abandonments',  'schedule': crontab(hour=1, minute=0)},
    'analytics-cleanup-old-events':     {'task': 'apps.analytics.tasks.cleanup_old_events',       'schedule': crontab(hour=2, minute=0, day_of_week=0)},
    'catalog-sync-tns':                 {'task': 'apps.catalog.tasks.sync_tns_products',          'schedule': crontab(minute='*/30')},
    'catalog-cleanup-expired':          {'task': 'apps.catalog.tasks.cleanup_expired',            'schedule': crontab(hour=3, minute=0)},
    'catalog-compute-metrics':          {'task': 'apps.catalog.tasks.compute_metrics',            'schedule': crontab(hour=4, minute=0)},
    'analytics-flush-buffer': {
        'task':     'apps.analytics.tasks.flush_analytics_buffer',
        'schedule': 30.0,  # Every 30 seconds
    },
    'catalog-check-low-stock': {
        'task':     'apps.catalog.tasks.check_low_stock',
        'schedule': crontab(hour=8, minute=0),  # Every day 8am
    },
}