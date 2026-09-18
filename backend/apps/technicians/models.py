import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone


class RepairTicket(models.Model):
    """
    Ticket de reparación técnica (celulares, equipos, etc.). El cliente
    lo crea al dejar su equipo; un técnico lo diagnostica y actualiza su
    estado hasta la entrega. El tracking público (sin login) se hace por
    ticket_number, por eso el prefijo 'REP-' es parte del contrato con
    RepairTicketViewSet.public_tracking().
    """
    class Status(models.TextChoices):
        RECEIVED     = 'received',     'Recibido'
        DIAGNOSIS    = 'diagnosis',    'En diagnóstico'
        IN_PROGRESS  = 'in_progress',  'En reparación'
        WAITING_PART = 'waiting_part', 'Esperando repuesto'
        READY        = 'ready',        'Listo para recoger'
        DELIVERED    = 'delivered',    'Entregado'

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket_number  = models.CharField(max_length=20, unique=True, db_index=True)
    status         = models.CharField(max_length=20, choices=Status.choices, default=Status.RECEIVED)

    customer    = models.ForeignKey('core.User', on_delete=models.PROTECT, related_name='repair_tickets')
    technician  = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_repair_tickets')

    device_type    = models.CharField(max_length=100)
    device_brand   = models.CharField(max_length=100, blank=True)
    device_model   = models.CharField(max_length=100, blank=True)
    serial_number  = models.CharField(max_length=100, blank=True)
    reported_issue = models.TextField(blank=True)

    diagnosis_notes  = models.TextField(blank=True)
    technician_notes = models.TextField(blank=True)

    estimated_cost = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    final_cost     = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)

    received_at  = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at   = models.DateTimeField(auto_now=True)
    ready_at     = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'technicians_repair_tickets'
        ordering = ['-received_at']
        indexes = [
            models.Index(fields=['status', 'received_at']),
            models.Index(fields=['technician', 'status']),
        ]

    def save(self, *args, **kwargs):
        if not self.ticket_number:
            today = timezone.now().strftime('%y%m%d')
            seq   = RepairTicket.objects.filter(ticket_number__startswith=f'REP-{today}').count() + 1
            self.ticket_number = f'REP-{today}-{seq:04d}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.ticket_number} ({self.get_status_display()})'


class RepairPart(models.Model):
    """Repuesto usado en una reparación — se suma al costo final del ticket."""
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket     = models.ForeignKey(RepairTicket, on_delete=models.CASCADE, related_name='parts')
    name       = models.CharField(max_length=200)
    quantity   = models.PositiveIntegerField(default=1)
    unit_cost  = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    added_by   = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'technicians_repair_parts'
        ordering = ['created_at']

    @property
    def subtotal(self):
        return self.unit_cost * self.quantity

    def __str__(self):
        return f'{self.name} x{self.quantity} ({self.ticket.ticket_number})'


class RepairImage(models.Model):
    """Foto adjunta a un ticket (antes/después, evidencia de daño, etc.)."""
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket      = models.ForeignKey(RepairTicket, on_delete=models.CASCADE, related_name='images')
    image       = models.ImageField(upload_to='repairs/%Y/%m/')
    caption     = models.CharField(max_length=200, blank=True)
    uploaded_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'technicians_repair_images'
        ordering = ['created_at']