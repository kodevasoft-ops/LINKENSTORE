import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator


class CheckoutSession(models.Model):
    """
    Agrupa el pago cuando el carrito mezcla productos de varios puntos.
    UN solo pago en Wompi cubre toda la sesión; al aprobarse, cada Order
    hija (una por punto) pasa a PAID y aparece en las "ventas pendientes"
    de su propio punto para que su vendedor la facture en TNS.
    """
    class Status(models.TextChoices):
        PENDING   = 'pending',   'Pendiente de pago'
        PAID      = 'paid',      'Pagado'
        CANCELLED = 'cancelled', 'Cancelado'
        REFUNDED  = 'refunded',  'Reembolsado'

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_number = models.CharField(max_length=20, unique=True, db_index=True)
    customer       = models.ForeignKey('core.User', on_delete=models.PROTECT, related_name='checkout_sessions')
    status         = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    shipping_name    = models.CharField(max_length=200, blank=True)
    shipping_phone    = models.CharField(max_length=30, blank=True)
    shipping_address = models.CharField(max_length=400, blank=True)
    shipping_city    = models.CharField(max_length=120, blank=True)
    shipping_notes   = models.TextField(blank=True)
    requires_shipping = models.BooleanField(default=False)  # true si el cliente es de otra ciudad y pidió envío

    # Documento de identidad — obligatorio en la práctica para poder facturar
    # y crear el Tercero en TNS. Se captura en el checkout si el cliente
    # todavía no lo tiene guardado en su perfil.
    document_type   = models.CharField(max_length=5, blank=True)
    document_number = models.CharField(max_length=30, blank=True)

    subtotal        = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    discount_pct    = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0'))
    coupon_code     = models.CharField(max_length=50, blank=True)
    total           = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    currency        = models.CharField(max_length=3, default='COP')

    wompi_reference      = models.CharField(max_length=100, blank=True, null=True, unique=True, db_index=True)
    wompi_transaction_id = models.CharField(max_length=100, blank=True, db_index=True)

    created_at   = models.DateTimeField(auto_now_add=True, db_index=True)
    paid_at      = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'checkout_sessions'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.session_number:
            today = timezone.now().strftime('%y%m%d')
            seq   = CheckoutSession.objects.filter(session_number__startswith=f'CHK-{today}').count() + 1
            self.session_number = f'CHK-{today}-{seq:04d}'
        if not self.wompi_reference:
            self.wompi_reference = self.session_number
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.session_number} ({self.get_status_display()})'


class Order(models.Model):
    """
    Una Order = la venta de UN punto dentro de una sesión de checkout.
    Si el carrito tenía productos de 3 puntos, esa compra genera 3 Order,
    todas ligadas a la misma CheckoutSession y pagadas de una sola vez.
    """
    class Status(models.TextChoices):
        PENDING   = 'pending',   'Pendiente de pago'
        PAID      = 'paid',      'Pagado — pendiente de facturar en TNS'
        CONFIRMED = 'confirmed', 'Confirmado en TNS'
        SHIPPED   = 'shipped',   'Enviado'
        DELIVERED = 'delivered', 'Entregado'
        CANCELLED = 'cancelled', 'Cancelado'
        REFUNDED  = 'refunded',  'Reembolsado'

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_number     = models.CharField(max_length=20, unique=True, db_index=True)
    checkout_session = models.ForeignKey(CheckoutSession, on_delete=models.CASCADE, related_name='orders')
    punto            = models.ForeignKey('catalog.Punto', on_delete=models.PROTECT, related_name='orders')
    customer         = models.ForeignKey('core.User', on_delete=models.PROTECT, related_name='orders')
    advisor          = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='advised_orders')
    status           = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    total    = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))

    # Facturación electrónica: se factura del lado de TNS; aquí solo registramos el estado.
    tns_confirmed        = models.BooleanField(default=False)
    tns_confirmation_ref = models.CharField(max_length=100, blank=True)
    tns_confirmed_at     = models.DateTimeField(null=True, blank=True)
    invoice_status       = models.CharField(
        max_length=20, default='pending',
        choices=[('pending', 'Pendiente de generación'), ('generated', 'Factura generada')],
    )

    created_at   = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at   = models.DateTimeField(auto_now=True)
    paid_at      = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'orders'
        ordering = ['-created_at']
        indexes  = [
            models.Index(fields=['customer', 'status']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['punto', 'status']),
        ]

    def save(self, *args, **kwargs):
        if not self.order_number:
            today = timezone.now().strftime('%y%m%d')
            seq   = Order.objects.filter(order_number__startswith=f'ORD-{today}').count() + 1
            self.order_number = f'ORD-{today}-{seq:04d}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.order_number} · {self.punto.name if self.punto_id else "?"} ({self.get_status_display()})'


class OrderItem(models.Model):
    id                    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order                 = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product               = models.ForeignKey('catalog.Product', on_delete=models.PROTECT, related_name='order_items')
    product_name_snapshot = models.CharField(max_length=200, blank=True)
    unit_price            = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    quantity              = models.PositiveIntegerField(default=1)

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

    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    checkout_session  = models.ForeignKey(CheckoutSession, on_delete=models.CASCADE, related_name='payments')
    gateway_reference = models.CharField(max_length=200, blank=True, db_index=True)  # ID de transacción Wompi
    amount            = models.DecimalField(max_digits=14, decimal_places=2)
    currency          = models.CharField(max_length=3, default='COP')
    status            = models.CharField(max_length=20, choices=Status.choices, default=Status.REQUIRES_PAYMENT)
    raw_webhook       = models.JSONField(default=dict, blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payments'
        ordering = ['-created_at']


class Envio(models.Model):
    """
    Envío por transportadora (hoy solo Interrápidísimo). El vendedor/admin
    solo ingresa el número de guía — el rastreo se consulta en vivo vía
    InterSoft API, nunca se gestiona la logística desde aquí.
    """
    class Status(models.TextChoices):
        CREADO      = 'creado',      'Guía registrada'
        EN_TRANSITO = 'en_transito', 'En tránsito'
        ENTREGADO   = 'entregado',   'Entregado'
        NOVEDAD     = 'novedad',     'Con novedad'
        DESCONOCIDO = 'desconocido', 'Sin información aún'

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    checkout_session = models.ForeignKey(CheckoutSession, on_delete=models.CASCADE, related_name='envios')
    carrier          = models.CharField(max_length=30, default='interrapidisimo')
    guide_number     = models.CharField(max_length=50, db_index=True)
    destination_city = models.CharField(max_length=120, blank=True)
    status           = models.CharField(max_length=20, choices=Status.choices, default=Status.CREADO)
    last_status_raw  = models.JSONField(default=dict, blank=True)  # última respuesta cruda de InterSoft
    created_by       = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, related_name='envios_creados')
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'envios'
        ordering = ['-created_at']
        indexes  = [models.Index(fields=['guide_number'])]
        # IDEMPOTENCIA: un solo envío por transportadora por sesión de checkout —
        # crear dos veces la guía para la misma venta actualiza, nunca duplica.
        unique_together = [['checkout_session', 'carrier']]

    def __str__(self):
        return f'Guía {self.guide_number} ({self.get_status_display()})'


class EnvioConsulta(models.Model):
    """
    Historial: cada vez que alguien (cliente en la web pública, o staff)
    consulta el rastreo de una guía, se guarda aquí — nunca se sobreescribe.
    """
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    envio        = models.ForeignKey(Envio, on_delete=models.CASCADE, related_name='consultas', null=True, blank=True)
    guide_number = models.CharField(max_length=50, db_index=True)  # se guarda aunque no exista Envio asociado
    found        = models.BooleanField(default=False)
    raw_response = models.JSONField(default=dict, blank=True)
    ip_hash      = models.CharField(max_length=64, blank=True)
    queried_at   = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'envio_consultas'
        ordering = ['-queried_at']


class Coupon(models.Model):
    """
    Cupón de descuento real, gestionado en BD — reemplaza el diccionario
    hardcodeado que vivía en el serializer. Global (aplica a toda la
    sesión de checkout, sin importar el punto) — solo SuperAdmin lo crea,
    porque afecta el descuento de todos los puntos por igual.
    """
    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code                = models.CharField(max_length=30, unique=True, db_index=True)
    discount_pct        = models.DecimalField(max_digits=5, decimal_places=2)
    is_active           = models.BooleanField(default=True)
    valid_from          = models.DateTimeField(null=True, blank=True)   # null = sin fecha de inicio
    valid_until         = models.DateTimeField(null=True, blank=True)   # null = sin fecha de fin
    max_uses            = models.PositiveIntegerField(null=True, blank=True)  # null = ilimitado
    used_count          = models.PositiveIntegerField(default=0)
    min_purchase_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    created_by          = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, related_name='+')
    created_at          = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'coupons'
        ordering = ['-created_at']

    def is_valid_now(self, subtotal=None) -> tuple[bool, str]:
        """Devuelve (es_valido, motivo_si_no) — un solo lugar con toda la regla de validez."""
        if not self.is_active:
            return False, 'Este cupón ya no está activo.'
        now = timezone.now()
        if self.valid_from and now < self.valid_from:
            return False, 'Este cupón todavía no está vigente.'
        if self.valid_until and now > self.valid_until:
            return False, 'Este cupón ya expiró.'
        if self.max_uses is not None and self.used_count >= self.max_uses:
            return False, 'Este cupón alcanzó su límite de usos.'
        if subtotal is not None and self.min_purchase_amount and subtotal < self.min_purchase_amount:
            return False, f'Este cupón requiere una compra mínima de ${self.min_purchase_amount:,.0f}.'
        return True, ''

    def __str__(self):
        return f'{self.code} (-{self.discount_pct}%)'
