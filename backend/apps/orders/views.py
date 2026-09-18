"""
apps/orders/views.py
- CheckoutSessionViewSet: crea la sesión (split por punto), expone checkout Wompi
- WompiWebhookView: verifica firma, marca sesión + todas sus Order como PAID
- EnvioViewSet: vendedor/admin registra guía de Interrápidísimo
- TrackShipmentView: rastreo PÚBLICO por número de guía — guarda historial siempre
- REGLA DE NEGOCIO: nada de este archivo descuenta o restaura stock.
"""
import hashlib
import logging

from django.conf import settings as django_settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.core.permissions import IsVendedorOrAbove, CanViewSalesReports, scoped_to_own_punto, IsSuperAdmin
from .models import CheckoutSession, Order, Payment, Envio, EnvioConsulta, Coupon
from .serializers import (
    OrderSerializer, CheckoutSessionCreateSerializer, CheckoutSessionDetailSerializer, EnvioSerializer,
)
from .services.wompi import WompiClient
from .services.intersoft import InterSoftClient

logger = logging.getLogger('katalog.orders')


def _ip_hash(request) -> str:
    ip = request.META.get('HTTP_X_REAL_IP') or \
         request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or \
         request.META.get('REMOTE_ADDR', '')
    return hashlib.sha256(ip.encode()).hexdigest() if ip else ''


class CheckoutSessionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    http_method_names  = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        qs = CheckoutSession.objects.select_related('customer').prefetch_related('orders__items__product', 'envios')
        if user.role in ('vendedor', 'administrador', 'supervisor', 'superadmin'):
            return qs
        return qs.filter(customer=user)

    def get_serializer_class(self):
        if self.action == 'create': return CheckoutSessionCreateSerializer
        return CheckoutSessionDetailSerializer

    def create(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data, context={'request': request})
        s.is_valid(raise_exception=True)
        session = s.save()
        return Response(CheckoutSessionDetailSerializer(session).data, status=201)

    @action(detail=True, methods=['get'], url_path='checkout')
    def checkout(self, request, pk=None):
        session = self.get_object()
        if session.customer_id != request.user.id and request.user.role not in ('administrador', 'superadmin'):
            return Response({'detail': 'No autorizado.'}, status=403)
        if session.status != CheckoutSession.Status.PENDING:
            return Response({'detail': 'Esta sesión ya no admite pago.'}, status=400)

        client = WompiClient()
        if not client.is_configured():
            return Response({'detail': 'Pasarela de pago no configurada.'}, status=503)

        amount_in_cents = int(session.total * 100)
        redirect_url = f'{django_settings.FRONTEND_URL}/checkout/resultado?order={session.session_number}'
        params = client.get_checkout_params(session.wompi_reference, amount_in_cents, redirect_url)
        return Response(params)


class ValidateCouponView(APIView):
    """Consulta pública de validez de un cupón, sin aplicarlo todavía — usado en el paso previo al checkout."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        code = (request.data.get('code') or '').strip().upper()
        if not code:
            return Response({'detail': 'Código de cupón requerido.'}, status=400)
        try:
            coupon = Coupon.objects.get(code=code)
        except Coupon.DoesNotExist:
            return Response({'detail': 'Cupón inválido o expirado.'}, status=400)
        valid, reason = coupon.is_valid_now()
        if not valid:
            return Response({'detail': reason}, status=400)
        return Response({'code': coupon.code, 'discount_pct': float(coupon.discount_pct)})


class CouponViewSet(viewsets.ModelViewSet):
    """Gestión de cupones — solo SuperAdmin, porque el descuento aplica a todos los puntos por igual."""
    permission_classes = [IsSuperAdmin]
    http_method_names  = ['get', 'post', 'patch', 'head', 'options']
    queryset            = Coupon.objects.all()

    def get_serializer_class(self):
        from .serializers import CouponSerializer
        return CouponSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class WompiWebhookView(APIView):
    """Verifica el checksum antes de procesar. Idempotente. Nunca toca stock."""
    permission_classes = [AllowAny]

    def post(self, request):
        payload = request.data
        client  = WompiClient()

        if not client.verify_webhook_signature(payload):
            logger.warning('[WOMPI] Firma de webhook inválida — payload descartado.')
            return Response({'detail': 'Firma inválida.'}, status=400)

        event = payload.get('event', '')
        tx    = payload.get('data', {}).get('transaction', {})
        if event == 'transaction.updated':
            self._handle_transaction(tx)
        return Response({'received': True})

    @staticmethod
    @transaction.atomic
    def _handle_transaction(tx: dict):
        reference = tx.get('reference')
        tx_status = tx.get('status')
        tx_id     = tx.get('id', '')
        if not reference:
            return
        try:
            session = CheckoutSession.objects.select_for_update().get(wompi_reference=reference)
        except CheckoutSession.DoesNotExist:
            logger.error('[WOMPI] Sesión no encontrada para referencia %s', reference)
            return

        if session.status != CheckoutSession.Status.PENDING:
            logger.info('[WOMPI] Webhook duplicado ignorado para %s (status=%s)', session.session_number, session.status)
            return

        session.wompi_transaction_id = tx_id

        if tx_status == 'APPROVED':
            session.status  = CheckoutSession.Status.PAID
            session.paid_at = timezone.now()
            session.save(update_fields=['status', 'paid_at', 'wompi_transaction_id'])
            session.orders.update(status=Order.Status.PAID, paid_at=timezone.now())
            Payment.objects.filter(checkout_session=session).update(
                status=Payment.Status.SUCCEEDED, gateway_reference=tx_id, raw_webhook=tx,
            )
            logger.info('[WOMPI] Pago aprobado: %s (%d órdenes)', session.session_number, session.orders.count())

            if session.coupon_code:
                Coupon.objects.filter(code=session.coupon_code).update(used_count=F('used_count') + 1)

            WompiWebhookView._notify_email(session)
            WompiWebhookView._notify_advisors(session)
            WompiWebhookView._notify_whatsapp(session)
            WompiWebhookView._sync_tns_tercero(session)

        elif tx_status in ('DECLINED', 'VOIDED', 'ERROR'):
            session.status = CheckoutSession.Status.CANCELLED
            session.cancelled_at = timezone.now()
            session.save(update_fields=['status', 'cancelled_at', 'wompi_transaction_id'])
            session.orders.update(status=Order.Status.CANCELLED, cancelled_at=timezone.now())
            Payment.objects.filter(checkout_session=session).update(
                status=Payment.Status.FAILED, gateway_reference=tx_id, raw_webhook=tx,
            )
            logger.warning('[WOMPI] Pago %s para %s', tx_status, session.session_number)

    @staticmethod
    def _notify_email(session):
        try:
            from django.core.mail import send_mail
            puntos = ', '.join(o.punto.name for o in session.orders.select_related('punto').all())
            send_mail(
                f'Confirmación de compra — {session.session_number}',
                f'Hola {session.customer.first_name},\n\nTu pago fue aprobado.\n\n'
                f'Puntos: {puntos}\nTotal: ${session.total:,.0f} COP\n\n'
                'Un asesor procesará tu pedido en breve.',
                django_settings.DEFAULT_FROM_EMAIL, [session.customer.email], fail_silently=True,
            )
        except Exception as e:
            logger.warning('[WOMPI] Email de confirmación falló: %s', e)

    @staticmethod
    def _notify_advisors(session):
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            layer = get_channel_layer()
            for order in session.orders.all():
                async_to_sync(layer.group_send)('advisors', {
                    'type': 'order_notification',
                    'data': {'type': 'venta_pendiente', 'order_number': order.order_number,
                             'punto_id': str(order.punto_id), 'total': str(order.total)},
                })
        except Exception as e:
            logger.debug('[WS] Notificación a vendedores falló: %s', e)

    @staticmethod
    def _notify_whatsapp(session):
        """
        Dispara la confirmación de venta por WhatsApp — no envía nada
        directamente aquí, delega a Celery (nunca bloquea el webhook de
        Wompi por un problema de WhatsApp) y la tarea revisa por sí misma
        si el módulo está activo.
        """
        try:
            from apps.whatsapp.tasks import send_order_confirmation
            send_order_confirmation.delay(str(session.id))
        except Exception as e:
            logger.debug('[WHATSAPP] No se pudo encolar confirmación: %s', e)

    @staticmethod
    def _sync_tns_tercero(session):
        """Crea el cliente como Tercero en TNS — nunca bloquea el webhook si falla."""
        try:
            from apps.orders.tasks import sync_tercero_tns
            sync_tercero_tns.delay(str(session.id))
        except Exception as e:
            logger.debug('[TNS] No se pudo encolar creación de tercero: %s', e)


class OrderViewSet(viewsets.ModelViewSet):
    """Órdenes individuales (una por punto) — para paneles de vendedor/administrador."""
    permission_classes = [IsAuthenticated]
    http_method_names  = ['get', 'patch', 'post', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        qs = Order.objects.select_related('customer', 'advisor', 'punto', 'checkout_session')\
                           .prefetch_related('items__product')
        if user.role in ('supervisor', 'superadmin'):
            pass  # ven todo, de todos los puntos
        elif scoped_to_own_punto(user):
            qs = qs.filter(punto_id=user.punto_id)  # SOLO su propio punto
        else:
            qs = qs.filter(customer=user)
        if sf := self.request.query_params.get('status'):
            qs = qs.filter(status=sf)
        return qs

    @action(detail=True, methods=['post'], url_path='confirm-tns', permission_classes=[IsVendedorOrAbove])
    def confirm_tns(self, request, pk=None):
        order = self.get_object()
        if scoped_to_own_punto(request.user) and str(order.punto_id) != str(request.user.punto_id):
            return Response({'detail': 'No puedes gestionar ventas de otro punto.'}, status=403)
        ref = (request.data.get('reference') or '').strip()
        if not ref:
            return Response({'detail': 'Referencia de factura TNS requerida.'}, status=400)
        order.tns_confirmed        = True
        order.tns_confirmation_ref = ref
        order.tns_confirmed_at     = timezone.now()
        order.invoice_status       = 'generated'
        order.advisor              = request.user
        if order.status == Order.Status.PAID:
            order.status = Order.Status.CONFIRMED
        order.save()
        logger.info('[TNS] %s confirmado manualmente por %s ref=%s', order.order_number, request.user.email, ref)
        return Response(OrderSerializer(order).data)

    @action(detail=False, methods=['get'], url_path='ventas-pendientes', permission_classes=[CanViewSalesReports])
    def ventas_pendientes(self, request):
        """'Ventas en línea pendientes' — solo del punto del vendedor; todo para superadmin/supervisor. Paginado."""
        qs = Order.objects.filter(status=Order.Status.PAID, tns_confirmed=False)\
                          .select_related('customer', 'punto').prefetch_related('items__product')\
                          .order_by('paid_at')
        if scoped_to_own_punto(request.user):
            qs = qs.filter(punto_id=request.user.punto_id)
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(OrderSerializer(page, many=True).data)
        return Response(OrderSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'], url_path='ventas-feed', permission_classes=[CanViewSalesReports])
    def ventas_feed(self, request):
        """
        Feed unificado para SuperAdmin/Supervisor: 'VENTAS #122145 · Punto Accesorios',
        con cliente, productos y estado de facturación electrónica. Paginado (no un
        slice fijo) para escalar sin límite artificial de 100 resultados.
        """
        qs = Order.objects.select_related('customer', 'punto').prefetch_related('items__product')
        if scoped_to_own_punto(request.user):
            qs = qs.filter(punto_id=request.user.punto_id)
        if pf := request.query_params.get('punto'):
            qs = qs.filter(punto__slug=pf)
        qs = qs.order_by('-created_at')
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(OrderSerializer(page, many=True).data)
        return Response(OrderSerializer(qs, many=True).data)


class EnvioViewSet(viewsets.ModelViewSet):
    """El vendedor/admin solo registra el número de guía — nada más."""
    permission_classes = [IsVendedorOrAbove]
    http_method_names  = ['get', 'post', 'head', 'options']
    serializer_class   = EnvioSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Envio.objects.select_related('checkout_session').all()
        if scoped_to_own_punto(user):
            qs = qs.filter(checkout_session__orders__punto_id=user.punto_id).distinct()
        return qs

    def create(self, request, *args, **kwargs):
        session_id = request.data.get('checkout_session_id')
        guide      = (request.data.get('guide_number') or '').strip()
        city       = (request.data.get('destination_city') or '').strip()
        carrier    = (request.data.get('carrier') or 'interrapidisimo').strip()
        if not session_id or not guide:
            return Response({'detail': 'checkout_session_id y guide_number son requeridos.'}, status=400)
        try:
            session = CheckoutSession.objects.get(id=session_id)
        except CheckoutSession.DoesNotExist:
            return Response({'detail': 'Sesión de checkout no encontrada.'}, status=404)

        if scoped_to_own_punto(request.user) and not session.orders.filter(punto_id=request.user.punto_id).exists():
            return Response({'detail': 'No puedes gestionar envíos de otro punto.'}, status=403)

        # IDEMPOTENCIA: si ya existe un envío de esta transportadora para esta
        # sesión, se actualiza (ej. corregir un número de guía mal digitado)
        # en vez de crear un registro duplicado — la restricción única en BD
        # (checkout_session, carrier) respalda esto incluso ante llamadas concurrentes.
        envio, created = Envio.objects.update_or_create(
            checkout_session=session, carrier=carrier,
            defaults={'guide_number': guide, 'destination_city': city, 'created_by': request.user},
        )
        logger.info('[ENVIOS] Guía %s %s para %s por %s',
                    guide, 'registrada' if created else 'actualizada', session.session_number, request.user.email)
        return Response(EnvioSerializer(envio).data, status=201 if created else 200)


class TrackShipmentView(APIView):
    """
    Rastreo PÚBLICO: el cliente solo escribe el número de guía en 'Rastrear
    mi envío' en la página principal. Cada consulta se guarda en el
    historial (EnvioConsulta), exista o no un Envio registrado para esa guía.
    """
    permission_classes = [AllowAny]

    class _TrackThrottle(AnonRateThrottle):
        scope = 'search'

    throttle_classes = [_TrackThrottle]

    def get(self, request):
        guide = (request.query_params.get('guia') or '').strip().upper()
        if not guide:
            return Response({'detail': 'Número de guía requerido.'}, status=400)

        client = InterSoftClient()
        result = client.consultar_guia(guide)

        envio = Envio.objects.filter(guide_number__iexact=guide).select_related('checkout_session').first()

        EnvioConsulta.objects.create(
            envio=envio,
            guide_number=guide,
            found=bool(result.get('encontrado')),
            raw_response=result.get('raw') or {},
            ip_hash=_ip_hash(request),
        )

        if envio and result.get('encontrado'):
            envio.last_status_raw = result.get('datos') or {}
            envio.save(update_fields=['last_status_raw', 'updated_at'])

        if not result.get('encontrado'):
            return Response({'encontrado': False, 'error': result.get('error') or 'Guía no encontrada.'}, status=404)

        return Response({
            'encontrado': True,
            'guide_number': guide,
            'carrier': 'interrapidisimo',
            'datos': result.get('datos'),
        })
