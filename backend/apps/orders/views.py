"""
apps/orders/views.py
- OrderViewSet: CRUD con IDOR protection (customer ve solo sus órdenes)
- Stripe webhook: HMAC verification + idempotencia
- ValidateCouponView: cupones validados en backend
"""
import logging
import stripe
from django.conf import settings as django_settings
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.core.permissions import IsAdvisorOrAbove
from .models import Order, Payment
from .serializers import OrderSerializer, OrderCreateSerializer, OrderDetailSerializer

logger = logging.getLogger('katalog.orders')


class OrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    http_method_names  = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        qs = Order.objects.select_related('customer', 'advisor').prefetch_related('items__product')
        # IDOR PROTECTION: customer only sees their own orders
        if user.role in ('advisor', 'admin', 'superadmin'):
            if sf := self.request.query_params.get('status'):
                qs = qs.filter(status=sf)
            return qs
        return qs.filter(customer=user)  # strict filter — no UUID guessing

    def get_serializer_class(self):
        if self.action == 'create':   return OrderCreateSerializer
        if self.action == 'retrieve': return OrderDetailSerializer
        return OrderSerializer

    def create(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data, context={'request': request})
        s.is_valid(raise_exception=True)
        order = s.save()
        return Response(OrderDetailSerializer(order, context={'request': request}).data, status=201)

    @action(detail=True, methods=['patch'], url_path='status', permission_classes=[IsAdvisorOrAbove])
    def update_status(self, request, pk=None):
        order = self.get_object()
        ns = request.data.get('status')
        if ns not in {c[0] for c in Order.Status.choices}:
            return Response({'detail': 'Estado inválido.'}, status=400)
        old_status = order.status
        order.status = ns
        if ns == Order.Status.DELIVERED: order.delivered_at = timezone.now()
        if ns == Order.Status.CANCELLED:
            order.cancelled_at = timezone.now()
            self._restore_stock(order)  # RESTORE STOCK on cancel
        order.save()
        logger.info('[ORDERS] %s: %s → %s by %s', order.order_number, old_status, ns, request.user.email)
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'], url_path='confirm-tns', permission_classes=[IsAdvisorOrAbove])
    def confirm_tns(self, request, pk=None):
        order = self.get_object()
        ref = (request.data.get('reference') or '').strip()
        if not ref:
            return Response({'detail': 'Referencia TNS requerida.'}, status=400)
        order.tns_confirmed        = True
        order.tns_confirmation_ref = ref
        order.tns_confirmed_at     = timezone.now()
        order.advisor              = request.user
        if order.status == Order.Status.PAID:
            order.status = Order.Status.CONFIRMED
        order.save()
        logger.info('[TNS] %s confirmed by %s ref=%s', order.order_number, request.user.email, ref)
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'], url_path='assign-advisor', permission_classes=[IsAdvisorOrAbove])
    def assign_advisor(self, request, pk=None):
        from apps.core.models import User
        order = self.get_object()
        try:
            advisor = User.objects.get(id=request.data.get('advisor_id'), role='advisor')
        except User.DoesNotExist:
            return Response({'detail': 'Asesor no encontrado.'}, status=404)
        order.advisor = advisor
        order.save(update_fields=['advisor'])
        return Response(OrderSerializer(order).data)

    @action(detail=False, methods=['get'], url_path='unassigned', permission_classes=[IsAdvisorOrAbove])
    def unassigned(self, request):
        qs = Order.objects.filter(status=Order.Status.PAID, advisor__isnull=True)\
                          .select_related('customer').prefetch_related('items__product')
        return Response(OrderSerializer(qs, many=True).data)

    @staticmethod
    def _restore_stock(order: Order):
        """Restores stock when order is cancelled — prevents inventory leak."""
        for item in order.items.select_related('product').all():
            item.product.stock += item.quantity
            item.product.save(update_fields=['stock'])
            logger.info('[ORDERS] Stock restored: product=%s qty=%d', item.product.id, item.quantity)


class ValidateCouponView(APIView):
    permission_classes = [IsAuthenticated]
    COUPONS = {'BIENVENIDO10': 10, 'KATALOG15': 15}

    def post(self, request):
        code = (request.data.get('code') or '').strip().upper()
        if code not in self.COUPONS:
            return Response({'detail': 'Cupón inválido o expirado.'}, status=400)
        return Response({'code': code, 'discount_pct': self.COUPONS[code]})


class StripeWebhookView(APIView):
    """
    Stripe webhook — HMAC signature verified before any processing.
    Idempotent: only processes PENDING orders.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        payload    = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, django_settings.STRIPE_WEBHOOK_SECRET
            )
        except stripe.error.SignatureVerificationError as e:
            logger.warning('[STRIPE] Invalid signature: %s', e)
            return Response({'detail': 'Firma inválida.'}, status=400)
        except ValueError as e:
            logger.warning('[STRIPE] Malformed payload: %s', e)
            return Response({'detail': 'Payload inválido.'}, status=400)

        event_type = event['type']
        data_obj   = event['data']['object']

        if event_type == 'payment_intent.succeeded':
            self._handle_success(data_obj)
        elif event_type == 'payment_intent.payment_failed':
            self._handle_failure(data_obj)
        elif event_type == 'charge.refunded':
            self._handle_refund(data_obj)

        return Response({'received': True})

    @staticmethod
    @transaction.atomic
    def _handle_success(intent):
        order_id = intent.get('metadata', {}).get('order_id')
        if not order_id:
            return
        try:
            # select_for_update prevents race condition with concurrent webhooks
            order = Order.objects.select_for_update().get(id=order_id)
        except Order.DoesNotExist:
            logger.error('[STRIPE] Order not found: %s', order_id)
            return
        # IDEMPOTENCY: only process if still PENDING
        if order.status != Order.Status.PENDING:
            logger.info('[STRIPE] Duplicate webhook ignored for order %s (status=%s)', order.order_number, order.status)
            return
        order.status  = Order.Status.PAID
        order.paid_at = timezone.now()
        order.save(update_fields=['status', 'paid_at'])
        Payment.objects.filter(stripe_id=intent['id']).update(
            status=Payment.Status.SUCCEEDED, raw_webhook=intent
        )
        logger.info('[STRIPE] Payment succeeded: %s', order.order_number)
        # Email confirmation to customer
        try:
            from django.core.mail import send_mail
            from django.conf import settings as _s
            items_text = ', '.join([f'{i.quantity}x {i.product_name_snapshot}' for i in order.items.all()])
            send_mail(
                f'Confirmacion de compra — {order.order_number}',
                f'Hola {order.customer.first_name},\n\nTu orden {order.order_number} fue pagada exitosamente.\n\nProductos: {items_text}\nTotal: ${order.total:,.0f} COP\n\nGracias por tu compra.',
                _s.DEFAULT_FROM_EMAIL,
                [order.customer.email],
                fail_silently=True,
            )
        except Exception as mail_err:
            logger.warning('[STRIPE] Email failed: %s', mail_err)
        # Notify advisors via WebSocket
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            layer = get_channel_layer()
            async_to_sync(layer.group_send)('advisors', {
                'type': 'order_notification',
                'data': {'type': 'new_order', 'order_number': order.order_number, 'total': str(order.total)}
            })
        except Exception as ws_err:
            logger.debug('[WS] Notify failed: %s', ws_err)

    @staticmethod
    @transaction.atomic
    def _handle_failure(intent):
        order_id = intent.get('metadata', {}).get('order_id')
        if not order_id:
            return
        try:
            order = Order.objects.select_for_update().get(id=order_id)
        except Order.DoesNotExist:
            return
        # Restore stock on payment failure
        if order.status == Order.Status.PENDING:
            for item in order.items.select_related('product').all():
                item.product.stock += item.quantity
                item.product.save(update_fields=['stock'])
        Payment.objects.filter(stripe_id=intent['id']).update(
            status=Payment.Status.FAILED, raw_webhook=intent
        )
        logger.warning('[STRIPE] Payment failed: %s', order.order_number if order else order_id)

    @staticmethod
    @transaction.atomic
    def _handle_refund(charge):
        payment_intent_id = charge.get('payment_intent')
        if not payment_intent_id:
            return
        Order.objects.filter(stripe_payment_intent_id=payment_intent_id).update(
            status=Order.Status.REFUNDED
        )
        Payment.objects.filter(stripe_id=payment_intent_id).update(
            status=Payment.Status.REFUNDED
        )
        logger.info('[STRIPE] Refund processed for intent %s', payment_intent_id)
