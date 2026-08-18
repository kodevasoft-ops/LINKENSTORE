import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING   = 'pending',   'Pendiente de pago'
        PAID      = 'paid',      'Pagado'
        CONFIRMED = 'confirmed', 'Confirmado en TNS'
        SHIPPED   = 'shipped',   'Enviado'
        DELIVERED = 'delivered', 'Entregado'
        CANCELLED = 'cancelled', 'Cancelado'
        REFUNDED  = 'refunded',  'Reembolsado'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_number = models.CharField(max_length=20, unique=True, db_index=True)
    customer     = models.ForeignKey('core.User', on_delete=models.PROTECT, related_name='orders')
    advisor      = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='advised_orders')
    status       = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    shipping_name    = models.CharField(max_length=200, blank=True)
    shipping_phone   = models.CharField(max_length=30, blank=True)
    shipping_address = models.CharField(max_length=400, blank=True)
    shipping_city    = models.CharField(max_length=120, blank=True)
    shipping_notes   = models.TextField(blank=True)

    subtotal        = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    discount_pct    = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0'))
    coupon_code     = models.CharField(max_length=50, blank=True)
    total           = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    currency        = models.CharField(max_length=3, default='COP')

    stripe_payment_intent_id = models.CharField(max_length=200, blank=True, db_index=True)
    stripe_client_secret     = models.CharField(max_length=300, blank=True)

    tns_confirmed        = models.BooleanField(default=False)
    tns_confirmation_ref = models.CharField(max_length=100, blank=True)
    tns_confirmed_at     = models.DateTimeField(null=True, blank=True)

    created_at   = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at   = models.DateTimeField(auto_now=True)
    paid_at      = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'orders'
        ordering = ['-created_at']
        indexes  = [models.Index(fields=['customer', 'status']), models.Index(fields=['status', 'created_at'])]

    def save(self, *args, **kwargs):
        if not self.order_number:
            today = timezone.now().strftime('%y%m%d')
            seq   = Order.objects.filter(order_number__startswith=f'ORD-{today}').count() + 1
            self.order_number = f'ORD-{today}-{seq:04d}'
        super().save(*args, **kwargs)

    def __str__(self): return f'{self.order_number} ({self.get_status_display()})'


class OrderItem(models.Model):
    id                   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order                = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product              = models.ForeignKey('catalog.Product', on_delete=models.PROTECT, related_name='order_items')
    product_name_snapshot = models.CharField(max_length=200, blank=True)
    unit_price           = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    quantity             = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = 'order_items'

    @property
    def subtotal(self): return self.unit_price * self.quantity

    def save(self, *args, **kwargs):
        if not self.product_name_snapshot and self.product_id:
            self.product_name_snapshot = self.product.name
        super().save(*args, **kwargs)


class Payment(models.Model):
    class Status(models.TextChoices):
        REQUIRES_PAYMENT = 'requires_payment', 'Requiere pago'
        PROCESSING       = 'processing',       'Procesando'
        SUCCEEDED        = 'succeeded',        'Exitoso'
        FAILED           = 'failed',           'Fallido'
        REFUNDED         = 'refunded',         'Reembolsado'

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order       = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payments')
    stripe_id   = models.CharField(max_length=200, blank=True, db_index=True)
    amount      = models.DecimalField(max_digits=14, decimal_places=2)
    currency    = models.CharField(max_length=3, default='COP')
    status      = models.CharField(max_length=20, choices=Status.choices, default=Status.REQUIRES_PAYMENT)
    raw_webhook = models.JSONField(default=dict, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payments'
        ordering = ['-created_at']


class RepairTicket(models.Model):
    class Status(models.TextChoices):
        RECEIVED     = 'received',     'Recibido'
        DIAGNOSIS    = 'diagnosis',    'En diagnóstico'
        IN_PROGRESS  = 'in_progress',  'En reparación'
        WAITING_PART = 'waiting_part', 'Esperando repuesto'
        READY        = 'ready',        'Listo para entrega'
        DELIVERED    = 'delivered',    'Entregado'
        CANCELLED    = 'cancelled',    'Cancelado'

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket_number   = models.CharField(max_length=20, unique=True, db_index=True)
    customer        = models.ForeignKey('core.User', on_delete=models.PROTECT, related_name='repair_tickets')
    technician      = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_repairs')
    status          = models.CharField(max_length=20, choices=Status.choices, default=Status.RECEIVED)
    device_type     = models.CharField(max_length=100)
    device_brand    = models.CharField(max_length=100, blank=True)
    device_model    = models.CharField(max_length=150, blank=True)
    serial_number   = models.CharField(max_length=100, blank=True)
    reported_issue  = models.TextField()
    diagnosis_notes = models.TextField(blank=True)
    technician_notes = models.TextField(blank=True)
    estimated_cost  = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    final_cost      = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    received_at     = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at      = models.DateTimeField(auto_now=True)
    ready_at        = models.DateTimeField(null=True, blank=True)
    delivered_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'repair_tickets'
        ordering = ['-received_at']
        indexes  = [models.Index(fields=['technician', 'status']), models.Index(fields=['customer', 'status'])]

    def save(self, *args, **kwargs):
        if not self.ticket_number:
            today = timezone.now().strftime('%y%m%d')
            seq   = RepairTicket.objects.filter(ticket_number__startswith=f'REP-{today}').count() + 1
            self.ticket_number = f'REP-{today}-{seq:04d}'
        super().save(*args, **kwargs)

    def __str__(self): return f'{self.ticket_number} ({self.get_status_display()})'


class RepairPart(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket     = models.ForeignKey(RepairTicket, on_delete=models.CASCADE, related_name='parts')
    name       = models.CharField(max_length=200)
    quantity   = models.PositiveIntegerField(default=1)
    unit_cost  = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    added_by   = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'repair_parts'

    @property
    def subtotal(self): return self.unit_cost * self.quantity


class RepairImage(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket      = models.ForeignKey(RepairTicket, on_delete=models.CASCADE, related_name='images')
    image       = models.ImageField(upload_to='repairs/%Y/%m/')
    caption     = models.CharField(max_length=200, blank=True)
    uploaded_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'repair_images'
