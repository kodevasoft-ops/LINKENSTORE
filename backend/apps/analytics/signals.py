import hashlib, logging
from django.db.models.signals import post_save
from django.dispatch import receiver
logger = logging.getLogger('katalog.analytics')

def _get_source(utm_source, referrer):
    if utm_source:
        s = utm_source.lower()
        if any(x in s for x in ('google','bing')): return 'organic'
        if 'email' in s: return 'email'
        if any(x in s for x in ('facebook','instagram','twitter','tiktok')): return 'social'
        return 'paid'
    if referrer:
        r = referrer.lower()
        if any(x in r for x in ('facebook','instagram','twitter','t.co')): return 'social'
        if any(x in r for x in ('google','bing','yahoo')): return 'organic'
        return 'referral'
    return 'direct'

@receiver(post_save, sender='core.User')
def create_customer_registration(sender, instance, created, **kwargs):
    if not created or instance.role not in ('customer',): return
    try:
        from apps.analytics.models import CustomerRegistration
        CustomerRegistration.objects.get_or_create(user=instance, defaults={'source': 'direct', 'ip_hash': ''})
    except Exception as e:
        logger.error('[ANALYTICS] signal error: %s', e)
