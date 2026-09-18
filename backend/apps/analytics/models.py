import uuid
from django.db import models
from django.utils import timezone
from datetime import timedelta


class SearchEvent(models.Model):
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    query         = models.CharField(max_length=300)
    results_count = models.PositiveIntegerField(default=0)
    ip_hash       = models.CharField(max_length=64, db_index=True)
    session_id    = models.CharField(max_length=64, blank=True, db_index=True)
    area_slug     = models.CharField(max_length=100, blank=True)
    user          = models.ForeignKey('core.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='searches')
    created_at    = models.DateTimeField(auto_now_add=True, db_index=True)
    class Meta:
        db_table = 'analytics_search_events'
        indexes  = [models.Index(fields=['created_at']), models.Index(fields=['query'])]


class PageView(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ip_hash    = models.CharField(max_length=64, db_index=True)
    path       = models.CharField(max_length=500)
    referrer   = models.CharField(max_length=500, blank=True)
    session_id = models.CharField(max_length=64, blank=True, db_index=True)
    user       = models.ForeignKey('core.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='page_views')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    class Meta:
        db_table = 'analytics_page_views'


class CartEvent(models.Model):
    TYPES = [('add_item','Añadió'),('remove_item','Quitó'),('update_qty','Actualizó'),
             ('view_cart','Vio'),('start_checkout','Checkout'),('abandon_cart','Abandonó'),('complete_order','Completó')]
    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type        = models.CharField(max_length=30, choices=TYPES, db_index=True)
    session_id        = models.CharField(max_length=64, db_index=True)
    ip_hash           = models.CharField(max_length=64, db_index=True)
    cart_items_count  = models.PositiveSmallIntegerField(default=0)
    cart_total        = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    area_name         = models.CharField(max_length=100, blank=True)
    inactivity_seconds = models.PositiveIntegerField(null=True, blank=True)
    user              = models.ForeignKey('core.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='cart_events')
    created_at        = models.DateTimeField(auto_now_add=True, db_index=True)
    class Meta:
        db_table = 'analytics_cart_events'


class CustomerRegistration(models.Model):
    SOURCES = [('organic','Orgánico'),('referral','Referido'),('direct','Directo'),
               ('social','Social'),('email','Email'),('paid','Publicidad')]
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user         = models.OneToOneField('core.User', on_delete=models.CASCADE, related_name='registration_analytics')
    source       = models.CharField(max_length=20, default='direct', choices=SOURCES)
    referrer     = models.CharField(max_length=500, blank=True)
    utm_source   = models.CharField(max_length=100, blank=True)
    utm_medium   = models.CharField(max_length=100, blank=True)
    utm_campaign = models.CharField(max_length=100, blank=True)
    ip_hash      = models.CharField(max_length=64, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True, db_index=True)
    class Meta:
        db_table = 'analytics_customer_registrations'


class CartAbandonment(models.Model):
    class Status(models.TextChoices):
        ABANDONED = 'abandoned', 'Abandonado'
        RECOVERED = 'recovered', 'Recuperado'
        EXPIRED   = 'expired',   'Expirado'

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_id          = models.CharField(max_length=64, db_index=True)
    email               = models.EmailField(blank=True, db_index=True)
    cart_total          = models.DecimalField(max_digits=14, decimal_places=2)
    items_count         = models.PositiveSmallIntegerField(default=0)
    status              = models.CharField(max_length=20, choices=Status.choices, default=Status.ABANDONED)
    time_in_cart_seconds = models.PositiveIntegerField(default=0)
    last_step           = models.CharField(max_length=30, default='cart')
    recovery_email_sent = models.BooleanField(default=False)
    recovery_email_at   = models.DateTimeField(null=True, blank=True)
    recovered_at        = models.DateTimeField(null=True, blank=True)
    abandoned_at        = models.DateTimeField(auto_now_add=True, db_index=True)
    expires_at          = models.DateTimeField()
    user                = models.ForeignKey('core.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='abandonments')

    class Meta:
        db_table = 'analytics_cart_abandonments'

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=48)
        super().save(*args, **kwargs)


class DailySummary(models.Model):
    id                   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date                 = models.DateField(unique=True, db_index=True)
    unique_visitors      = models.PositiveIntegerField(default=0)
    total_page_views     = models.PositiveIntegerField(default=0)
    total_searches       = models.PositiveIntegerField(default=0)
    unique_search_ips    = models.PositiveIntegerField(default=0)
    carts_created        = models.PositiveIntegerField(default=0)
    carts_abandoned      = models.PositiveIntegerField(default=0)
    carts_completed      = models.PositiveIntegerField(default=0)
    cart_abandonment_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    new_customers        = models.PositiveIntegerField(default=0)
    orders_count         = models.PositiveIntegerField(default=0)
    revenue              = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    created_at           = models.DateTimeField(auto_now_add=True)
    updated_at           = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'analytics_daily_summary'
