import uuid
from django.db import models
from django.utils import timezone
from apps.core.fields import EncryptedCharField


class WhatsAppConfig(models.Model):
    """
    Configuración única del módulo (singleton, como GlobalConfig).
    NACE PAUSADA (is_active=False) — nadie envía un solo mensaje hasta que
    un Administrador/SuperAdmin la activa manualmente desde el panel con
    credenciales reales de 360dialog.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    is_active = models.BooleanField(default=False)  # PAUSADO por defecto — regla explícita del negocio
    api_key   = EncryptedCharField(blank=True)       # D360-API-KEY, cifrado en reposo
    phone_display_name = models.CharField(max_length=100, blank=True)  # informativo

    # Ventana en la que 360dialog entrega mensajes (Central/Este de Europa
    # según su doc) — se guarda por si se necesita ajustar el webhook_url dinámicamente.
    webhook_basic_auth_user = models.CharField(max_length=100, blank=True)
    webhook_basic_auth_pass = EncryptedCharField(blank=True)

    # ── Disparadores configurables ──────────────────────────────────────
    respond_on_message   = models.BooleanField(default=True)   # responder apenas el cliente escribe
    cart_reminder_enabled = models.BooleanField(default=True)  # recordatorio de carrito abandonado
    cart_reminder_delay_minutes = models.PositiveIntegerField(default=60)
    followup_enabled     = models.BooleanField(default=True)   # "preguntó y se fue" — recordar que sigue ahí
    followup_delay_hours = models.PositiveIntegerField(default=24)
    order_confirmation_enabled = models.BooleanField(default=True)  # confirmar venta por WhatsApp

    activated_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    activated_at = models.DateTimeField(null=True, blank=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'whatsapp_config'
        verbose_name = 'Configuración de WhatsApp'

    def save(self, *args, **kwargs):
        self.pk = uuid.UUID('00000000-0000-0000-0000-000000000002')
        super().save(*args, **kwargs)

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=uuid.UUID('00000000-0000-0000-0000-000000000002'))
        return obj

    def is_usable(self) -> bool:
        """True solo si está activo Y tiene credencial cargada — doble candado."""
        return bool(self.is_active and self.api_key)


class WhatsAppConversation(models.Model):
    """
    Una conversación por número de teléfono. La ventana de 24h de WhatsApp
    (mensajes gratis mientras está abierta) se deriva de `last_inbound_at`.
    """
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone_number  = models.CharField(max_length=30, unique=True, db_index=True)  # formato E.164 sin '+'
    wa_id         = models.CharField(max_length=50, blank=True)
    customer      = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='whatsapp_conversations')
    contact_name  = models.CharField(max_length=150, blank=True)

    last_inbound_at  = models.DateTimeField(null=True, blank=True)
    last_outbound_at = models.DateTimeField(null=True, blank=True)

    # "Preguntó y se fue": True cuando el cliente escribió, se le respondió,
    # y todavía no ha vuelto a escribir — dispara el follow-up si se cumple el plazo.
    awaiting_customer_reply = models.BooleanField(default=False)
    followup_sent_at        = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'whatsapp_conversations'
        ordering = ['-updated_at']

    @property
    def window_open(self) -> bool:
        """True si estamos dentro de las 24h gratis desde el último mensaje del cliente."""
        if not self.last_inbound_at:
            return False
        return timezone.now() < self.last_inbound_at + timezone.timedelta(hours=24)

    def __str__(self):
        return f'{self.contact_name or self.phone_number}'


class WhatsAppMessage(models.Model):
    """
    Historial completo de mensajes — el "conector a la base de datos" que
    sabe qué se le dijo a quién y por qué. Cada mensaje de confirmación de
    venta/recordatorio queda ligado a la orden real que lo originó.
    """
    class Direction(models.TextChoices):
        INBOUND  = 'inbound',  'Recibido'
        OUTBOUND = 'outbound', 'Enviado'

    class Status(models.TextChoices):
        QUEUED    = 'queued',    'En cola'
        SENT      = 'sent',      'Enviado'
        DELIVERED = 'delivered', 'Entregado'
        READ      = 'read',      'Leído'
        FAILED    = 'failed',    'Fallido'

    class Trigger(models.TextChoices):
        MANUAL          = 'manual',           'Manual'
        AUTO_REPLY      = 'auto_reply',        'Respuesta automática'
        CART_REMINDER   = 'cart_reminder',     'Recordatorio de carrito'
        FOLLOW_UP       = 'follow_up',         'Seguimiento (preguntó y se fue)'
        ORDER_CONFIRM   = 'order_confirm',     'Confirmación de venta'
        CUSTOMER        = 'customer',          'Mensaje del cliente'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(WhatsAppConversation, on_delete=models.CASCADE, related_name='messages')
    direction    = models.CharField(max_length=10, choices=Direction.choices)
    trigger      = models.CharField(max_length=20, choices=Trigger.choices, default=Trigger.MANUAL)
    message_type = models.CharField(max_length=20, default='text')  # text | template
    template_name = models.CharField(max_length=100, blank=True)
    body         = models.TextField(blank=True)
    status       = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    wa_message_id = models.CharField(max_length=100, blank=True, db_index=True)

    # Conecta el mensaje con lo que pasó en el negocio — el "sepa todo" real.
    related_checkout_session = models.ForeignKey('orders.CheckoutSession', on_delete=models.SET_NULL, null=True, blank=True, related_name='whatsapp_messages')
    related_cart_abandonment = models.ForeignKey('analytics.CartAbandonment', on_delete=models.SET_NULL, null=True, blank=True, related_name='whatsapp_messages')

    raw_payload  = models.JSONField(default=dict, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'whatsapp_messages'
        ordering = ['-created_at']
        indexes  = [models.Index(fields=['conversation', 'created_at'])]
