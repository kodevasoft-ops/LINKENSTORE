"""
apps/technicians/views.py
SECURITY:
- Técnico solo ve y edita SUS tickets asignados (IDOR protection)
- Supervisor/SuperAdmin ven todo, de solo lectura para Supervisor a nivel de negocio
  (pero dentro del panel técnico, Supervisor también puede consultar el detalle)
- Image upload: valida magic bytes + extensión
- Public tracking: no expone datos sensibles del cliente
"""
import logging
import os
from django.db.models import Count
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from apps.core.permissions import IsAdministradorTecnico
from .models import RepairTicket, RepairPart, RepairImage
from .serializers import RepairTicketSerializer, RepairTicketPublicSerializer, RepairPartSerializer

logger = logging.getLogger('katalog.repairs')

ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
MAX_IMAGE_SIZE           = 5 * 1024 * 1024
IMAGE_MAGIC_BYTES = {
    b'\xff\xd8\xff': 'image/jpeg',
    b'\x89PNG':      'image/png',
    b'RIFF':         'image/webp',
}


def validate_image(file) -> str | None:
    if file.size > MAX_IMAGE_SIZE:
        return f'Imagen demasiado grande. Máximo {MAX_IMAGE_SIZE // 1024 // 1024}MB.'
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return f'Extensión no permitida. Usa: {", ".join(ALLOWED_IMAGE_EXTENSIONS)}'
    header = file.read(12)
    file.seek(0)
    valid_magic = any(header.startswith(magic) for magic in IMAGE_MAGIC_BYTES)
    if not valid_magic:
        return 'Archivo no es una imagen válida.'
    return None


class RepairTicketViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    http_method_names  = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        qs = RepairTicket.objects.select_related('customer', 'technician').prefetch_related('parts', 'images')
        if user.role == 'tecnico':
            # IDOR PROTECTION: el técnico solo ve SUS tickets asignados
            qs = qs.filter(technician=user)
        elif user.role in ('vendedor', 'administrador', 'administrador_tecnico', 'supervisor', 'superadmin'):
            pass  # ven todos los tickets
        else:
            # IDOR PROTECTION: el cliente solo ve sus propios tickets
            qs = qs.filter(customer=user)
        if sf := self.request.query_params.get('status'):
            qs = qs.filter(status=sf)
        return qs

    def get_serializer_class(self):
        return RepairTicketSerializer

    def perform_create(self, serializer):
        serializer.save(customer=self.request.user)
        logger.info('[REPAIRS] Nuevo ticket de customer=%s', self.request.user.email)

    def _assert_can_edit(self, ticket):
        """Bloquea si un técnico intenta editar un ticket que no es suyo. Supervisor nunca edita (solo lectura)."""
        user = self.request.user
        if user.role == 'supervisor':
            raise PermissionDenied('El rol Supervisor es de solo consulta.')
        if user.role == 'tecnico' and str(ticket.technician_id) != str(user.id):
            raise PermissionDenied('No tienes asignado este ticket.')

    @action(detail=True, methods=['patch'], url_path='status')
    def update_status(self, request, pk=None):
        ticket = self.get_object()
        self._assert_can_edit(ticket)
        ns = request.data.get('status')
        if ns not in {c[0] for c in RepairTicket.Status.choices}:
            return Response({'detail': 'Estado inválido.'}, status=400)
        old_status = ticket.status
        ticket.status = ns
        if 'diagnosis_notes' in request.data:  ticket.diagnosis_notes  = str(request.data['diagnosis_notes'])[:2000]
        if 'technician_notes' in request.data: ticket.technician_notes = str(request.data['technician_notes'])[:2000]
        if 'final_cost' in request.data:
            try: ticket.final_cost = float(request.data['final_cost'])
            except (ValueError, TypeError): pass
        if ns == RepairTicket.Status.READY:
            ticket.ready_at = timezone.now()
            try:
                from django.core.mail import send_mail
                from django.conf import settings as _s
                send_mail(
                    f'Tu equipo está listo — {ticket.ticket_number}',
                    f'Hola {ticket.customer.first_name}, tu {ticket.device_type} está listo para recoger.',
                    _s.DEFAULT_FROM_EMAIL, [ticket.customer.email], fail_silently=True,
                )
            except Exception as e:
                logger.warning('[REPAIRS] Email notify failed: %s', e)
        if ns == RepairTicket.Status.DELIVERED:
            ticket.delivered_at = timezone.now()
        ticket.save()
        logger.info('[REPAIRS] %s: %s → %s por %s', ticket.ticket_number, old_status, ns, request.user.email)
        return Response(RepairTicketSerializer(ticket).data)

    @action(detail=True, methods=['patch'], url_path='assign', permission_classes=[IsAdministradorTecnico])
    def assign_technician(self, request, pk=None):
        """Solo el Administrador Técnico (o SuperAdmin) asigna técnicos a tickets."""
        from apps.core.models import User
        ticket = self.get_object()
        try:
            tech = User.objects.get(id=request.data.get('technician_id'), role='tecnico')
        except User.DoesNotExist:
            return Response({'detail': 'Técnico no encontrado.'}, status=404)
        ticket.technician = tech
        if ticket.status == RepairTicket.Status.RECEIVED:
            ticket.status = RepairTicket.Status.DIAGNOSIS
        ticket.save()
        logger.info('[REPAIRS] %s asignado a %s', ticket.ticket_number, tech.email)
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            layer = get_channel_layer()
            async_to_sync(layer.group_send)(f'user_{tech.id}', {
                'type': 'repair_notification',
                'data': {'type': 'ticket_assigned', 'ticket': ticket.ticket_number, 'device': ticket.device_type},
            })
        except Exception as e:
            logger.debug('[WS] Tech notify failed: %s', e)
        return Response(RepairTicketSerializer(ticket).data)

    @action(detail=True, methods=['post'], url_path='parts')
    def add_part(self, request, pk=None):
        ticket = self.get_object()
        self._assert_can_edit(ticket)
        s = RepairPartSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.validated_data['name'] = s.validated_data['name'].strip()[:200]
        s.save(ticket=ticket, added_by=request.user)
        return Response(RepairTicketSerializer(ticket).data, status=201)

    @action(detail=True, methods=['post'], url_path='images')
    def add_image(self, request, pk=None):
        ticket = self.get_object()
        self._assert_can_edit(ticket)
        img = request.FILES.get('image')
        if not img:
            return Response({'detail': 'Imagen requerida.'}, status=400)
        error = validate_image(img)
        if error:
            return Response({'detail': error}, status=400)
        caption = str(request.data.get('caption', ''))[:200].strip()
        import uuid as _uuid
        ext = os.path.splitext(img.name)[1].lower()
        img.name = f'{_uuid.uuid4().hex}{ext}'
        RepairImage.objects.create(ticket=ticket, image=img, caption=caption, uploaded_by=request.user)
        return Response(RepairTicketSerializer(ticket).data, status=201)

    @action(detail=False, methods=['get'], url_path='public', permission_classes=[AllowAny])
    def public_tracking(self, request):
        tn = request.query_params.get('ticket', '').strip().upper()
        if not tn:
            return Response({'detail': 'Número de ticket requerido.'}, status=400)
        if not tn.startswith('REP-') or len(tn) > 20:
            return Response({'detail': 'Formato de ticket inválido.'}, status=400)
        try:
            ticket = RepairTicket.objects.select_related('technician').get(ticket_number=tn)
        except RepairTicket.DoesNotExist:
            return Response({'detail': 'Ticket no encontrado.'}, status=404)
        return Response(RepairTicketPublicSerializer(ticket).data)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        qs = self.get_queryset()
        by_status = dict(qs.values('status').annotate(c=Count('id')).values_list('status', 'c'))
        return Response({
            'total':        qs.count(),
            'received':     by_status.get('received', 0),
            'diagnosis':    by_status.get('diagnosis', 0),
            'in_progress':  by_status.get('in_progress', 0),
            'waiting_part': by_status.get('waiting_part', 0),
            'ready':        by_status.get('ready', 0),
            'delivered':    by_status.get('delivered', 0),
        })

    @action(detail=False, methods=['get'], url_path='tecnicos-disponibles', permission_classes=[IsAdministradorTecnico])
    def tecnicos_disponibles(self, request):
        """Lista liviana de técnicos activos — para el selector de 'asignar técnico'."""
        from apps.core.models import User
        tecnicos = User.objects.filter(role='tecnico', is_active=True).order_by('first_name')
        return Response([
            {'id': str(t.id), 'full_name': t.full_name, 'email': t.email}
            for t in tecnicos
        ])