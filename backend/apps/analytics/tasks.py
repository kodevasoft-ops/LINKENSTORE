import logging
from celery import shared_task
from django.utils import timezone
from datetime import timedelta, date
logger = logging.getLogger('katalog.analytics')

@shared_task(name='apps.analytics.tasks.compute_daily_summary', bind=True, max_retries=3)
def compute_daily_summary(self, target_date_str=None):
    from apps.analytics.models import SearchEvent, PageView, CartEvent, CartAbandonment, CustomerRegistration, DailySummary
    try:
        target = date.fromisoformat(target_date_str) if target_date_str else date.today() - timedelta(days=1)
        day_start = timezone.datetime.combine(target, timezone.datetime.min.time()).replace(tzinfo=timezone.utc)
        day_end   = day_start + timedelta(days=1)
        from django.db.models import Sum, Count
        pv_qs = PageView.objects.filter(created_at__gte=day_start, created_at__lt=day_end)
        sr_qs = SearchEvent.objects.filter(created_at__gte=day_start, created_at__lt=day_end)
        cart_qs = CartEvent.objects.filter(created_at__gte=day_start, created_at__lt=day_end)
        carts_created   = cart_qs.filter(event_type='add_item').values('session_id').distinct().count()
        carts_abandoned = cart_qs.filter(event_type='abandon_cart').count()
        carts_completed = cart_qs.filter(event_type='complete_order').count()
        new_customers   = CustomerRegistration.objects.filter(created_at__gte=day_start, created_at__lt=day_end).count()
        DailySummary.objects.update_or_create(date=target, defaults={'unique_visitors': pv_qs.values('ip_hash').distinct().count(), 'total_page_views': pv_qs.count(), 'total_searches': sr_qs.count(), 'unique_search_ips': sr_qs.values('ip_hash').distinct().count(), 'carts_created': carts_created, 'carts_abandoned': carts_abandoned, 'carts_completed': carts_completed, 'cart_abandonment_rate': round((carts_abandoned/max(carts_created,1))*100,2), 'new_customers': new_customers})
        return {'date': str(target)}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)

@shared_task(name='apps.analytics.tasks.send_abandonment_recovery')
def send_abandonment_recovery():
    from apps.analytics.models import CartAbandonment
    from django.core.mail import send_mail
    from django.conf import settings
    now = timezone.now()
    candidates = CartAbandonment.objects.filter(status='abandoned', recovery_email_sent=False, email__isnull=False, abandoned_at__lte=now-timedelta(hours=1), expires_at__gte=now).exclude(email='')[:50]
    sent = 0
    for a in candidates:
        try:
            send_mail('¡Tu carrito te espera! 🛒', f'Tienes {a.items_count} producto(s) por ${float(a.cart_total):,.0f} COP esperándote.', getattr(settings,'DEFAULT_FROM_EMAIL','noreply@katalog.com'), [a.email], fail_silently=False)
            a.recovery_email_sent = True; a.recovery_email_at = now; a.save(update_fields=['recovery_email_sent','recovery_email_at']); sent += 1
        except Exception as e:
            logger.warning('[ANALYTICS] recovery email: %s', e)
    return {'sent': sent}

@shared_task(name='apps.analytics.tasks.expire_old_abandonments')
def expire_old_abandonments():
    from apps.analytics.models import CartAbandonment
    count = CartAbandonment.objects.filter(status='abandoned', expires_at__lt=timezone.now()).update(status='expired')
    return {'expired': count}

@shared_task(name='apps.analytics.tasks.cleanup_old_events')
def cleanup_old_events():
    from apps.analytics.models import SearchEvent, PageView, CartEvent
    cutoff = timezone.now() - timedelta(days=90)
    return {'searches': SearchEvent.objects.filter(created_at__lt=cutoff).delete()[0], 'pageviews': PageView.objects.filter(created_at__lt=cutoff).delete()[0], 'carts': CartEvent.objects.filter(created_at__lt=cutoff).delete()[0]}

@shared_task(name='apps.analytics.tasks.flush_analytics_buffer')
def flush_analytics_buffer():
    """
    Flushes buffered analytics events from Redis to DB in bulk.
    Runs every 30 seconds via Celery Beat.
    Reduces DB write pressure from 1000 individual INSERTs to bulk operations.
    """
    from django.core.cache import cache
    import json

    # Flush search events
    search_keys = cache.keys('analytics_buf:search:*') if hasattr(cache, 'keys') else []
    search_items = []
    for key in list(search_keys)[:500]:
        raw = cache.get(key)
        if raw:
            try:
                search_items.append(json.loads(raw))
                cache.delete(key)
            except Exception:
                pass

    if search_items:
        SearchEvent.objects.bulk_create([
            SearchEvent(
                query=i.get('query','')[:300],
                results_count=i.get('results_count',0),
                ip_hash=i.get('ip_hash',''),
                session_id=i.get('session_id',''),
                area_slug=i.get('area_slug',''),
            ) for i in search_items
        ], ignore_conflicts=True)

    return {'search_flushed': len(search_items)}
