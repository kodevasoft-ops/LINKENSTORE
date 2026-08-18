import logging
from celery import shared_task
from django.utils import timezone
logger = logging.getLogger('katalog.catalog')

@shared_task(name='apps.catalog.tasks.sync_tns_products', bind=True, max_retries=3)
def sync_tns_products(self, area_id=None):
    from django.core.cache import cache
    lock_key = f'tns_sync_lock:{area_id or "all"}'
    # Distributed lock: only one worker syncs at a time (600s = 10 min)
    if not cache.add(lock_key, '1', 600):
        return {'skipped': True, 'reason': 'Another sync already running'}
    from apps.catalog.models import Product, TNSSyncLog
    from apps.catalog.services.tns import TNSClient
    log = TNSSyncLog.objects.create(status='running')
    synced = errors = 0
    try:
        client = TNSClient()
        qs = Product.objects.filter(is_active=True)
        if area_id: qs = qs.filter(category__area_id=area_id)
        for p in qs.iterator():
            try:
                data = client.fetch_product(p.sku)
                if not data: continue
                p.stock = data.get('stock', p.stock)
                p.tns_synced_at = timezone.now(); p.tns_sync_status = 'synced'
                p.save(update_fields=['stock','tns_synced_at','tns_sync_status']); synced += 1
            except Exception as e:
                logger.warning('[TNS] SKU %s: %s', p.sku, e); errors += 1
        log.status = 'completed'; log.products_synced = synced; log.errors_count = errors; log.finished_at = timezone.now(); log.save()
        cache.delete(lock_key)
        return {'synced': synced, 'errors': errors}
    except Exception as exc:
        log.status = 'failed'; log.error_log = str(exc); log.finished_at = timezone.now(); log.save()
        cache.delete(lock_key)
        raise self.retry(exc=exc, countdown=600)

@shared_task(name='apps.catalog.tasks.cleanup_expired')
def cleanup_expired():
    from apps.catalog.models import Promotion
    count = Promotion.objects.filter(is_active=True, ends_at__lt=timezone.now()).update(is_active=False)
    return {'deactivated': count}

@shared_task(name='apps.catalog.tasks.compute_metrics')
def compute_metrics():
    from django.db.models import Sum
    from apps.catalog.models import Product
    from apps.orders.models import OrderItem
    sold_map = dict(OrderItem.objects.filter(order__status__in=['paid','confirmed','shipped','delivered']).values('product_id').annotate(t=Sum('quantity')).values_list('product_id','t'))
    updated = 0
    for p in Product.objects.all().iterator():
        nc = sold_map.get(p.id, 0)
        if p.sold_count != nc: p.sold_count = nc; p.save(update_fields=['sold_count']); updated += 1
    return {'updated': updated}

@shared_task(name='apps.catalog.tasks.check_low_stock')
def check_low_stock():
    """Alert when product.stock <= min_stock — runs daily via Celery Beat."""
    from django.core.mail import send_mail
    from django.conf import settings
    products_low = Product.objects.filter(
        is_active=True,
        stock__lte=models.F('min_stock'),
        stock__gt=0,
    ).values('name', 'sku', 'stock', 'min_stock')

    products_out = Product.objects.filter(
        is_active=True, stock=0,
    ).values('name', 'sku')

    if not products_low.exists() and not products_out.exists():
        return {'low': 0, 'out': 0}

    lines = ['=== STOCK BAJO ===']
    for p in products_low:
        lines.append(f"• {p['name']} (SKU: {p['sku']}): {p['stock']} unidades (min: {p['min_stock']})")
    lines.append('\n=== SIN STOCK ===')
    for p in products_out:
        lines.append(f"• {p['name']} (SKU: {p['sku']}): AGOTADO")

    try:
        send_mail(
            'Alerta de stock bajo — Katalog',
            '\n'.join(lines),
            settings.DEFAULT_FROM_EMAIL,
            [settings.DEFAULT_FROM_EMAIL],
            fail_silently=True,
        )
    except Exception as e:
        logger.warning('[STOCK] Email alert failed: %s', e)

    return {'low': products_low.count(), 'out': products_out.count()}
