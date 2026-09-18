from decimal import Decimal
from collections import defaultdict
from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from apps.catalog.models import Product
from .models import CheckoutSession, Order, OrderItem, Payment, Envio, EnvioConsulta, Coupon


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product_name_snapshot', read_only=True)
    subtotal     = serializers.ReadOnlyField()
    class Meta:
        model  = OrderItem
        fields = ['id', 'product_name', 'unit_price', 'quantity', 'subtotal']


class OrderSerializer(serializers.ModelSerializer):
    items          = OrderItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    punto_name     = serializers.CharField(source='punto.name', read_only=True, default='')
    customer_name  = serializers.SerializerMethodField()
    checkout_session = serializers.CharField(source='checkout_session_id', read_only=True)
    requires_shipping = serializers.BooleanField(source='checkout_session.requires_shipping', read_only=True, default=False)
    class Meta:
        model  = Order
        fields = ['id', 'order_number', 'checkout_session', 'requires_shipping', 'punto_name', 'status', 'status_display', 'customer_name',
                  'subtotal', 'total', 'tns_confirmed', 'tns_confirmation_ref', 'invoice_status',
                  'items', 'created_at', 'paid_at']
        read_only_fields = ['id', 'order_number', 'status', 'subtotal', 'total',
                            'tns_confirmed', 'invoice_status', 'created_at', 'paid_at']
    def get_customer_name(self, obj):
        return obj.customer.full_name if obj.customer else ''


class EnvioSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    class Meta:
        model  = Envio
        fields = ['id', 'carrier', 'guide_number', 'destination_city', 'status',
                  'status_display', 'created_at', 'updated_at']
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = ['id', 'code', 'discount_pct', 'is_active', 'valid_from', 'valid_until',
                  'max_uses', 'used_count', 'min_purchase_amount', 'created_at']
        read_only_fields = ['id', 'used_count', 'created_at']

    def validate_code(self, value):
        return value.strip().upper()


class CheckoutSessionDetailSerializer(serializers.ModelSerializer):
    orders          = OrderSerializer(many=True, read_only=True)
    envio           = serializers.SerializerMethodField()
    status_display  = serializers.CharField(source='get_status_display', read_only=True)
    class Meta:
        model  = CheckoutSession
        fields = ['id', 'session_number', 'status', 'status_display', 'wompi_reference',
                  'shipping_name', 'shipping_city', 'requires_shipping',
                  'subtotal', 'total', 'orders', 'envio', 'created_at', 'paid_at']
        read_only_fields = ['id', 'session_number', 'status', 'wompi_reference',
                            'subtotal', 'total', 'created_at', 'paid_at']
    def get_envio(self, obj):
        envio = obj.envios.first()
        return EnvioSerializer(envio).data if envio else None


class CheckoutSessionCreateSerializer(serializers.Serializer):
    """
    Recibe el carrito completo (posiblemente con productos de varios puntos)
    y lo divide en una Order por punto — todas ligadas a UNA sola
    CheckoutSession, que es la que efectivamente paga en Wompi.
    NUNCA descuenta stock: el stock real se mueve solo cuando el vendedor
    factura manualmente en el portal TNS.
    """
    items             = serializers.ListField(child=serializers.DictField(), min_length=1, max_length=50)
    shipping_address  = serializers.DictField()
    requires_shipping = serializers.BooleanField(default=False)
    coupon_code       = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=50)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('El carrito debe tener al menos 1 producto.')
        return items

    def create(self, validated_data):
        request  = self.context['request']
        items_in = validated_data['items']
        address  = validated_data['shipping_address']
        coupon   = (validated_data.get('coupon_code') or '').strip().upper()

        idempotency_key = request.META.get('HTTP_IDEMPOTENCY_KEY', '')
        if idempotency_key:
            from django.core.cache import cache as _c
            sid = _c.get(f'checkout_idem:{idempotency_key}')
            if sid:
                try:
                    return CheckoutSession.objects.get(id=sid)
                except CheckoutSession.DoesNotExist:
                    pass

        with transaction.atomic():
            # 1. Validar productos y agrupar por punto — cada punto = 1 Order
            by_punto = defaultdict(list)
            for item in items_in:
                pid = item.get('product_id')
                qty = int(item.get('quantity', 1))
                if qty < 1 or qty > 50:
                    raise serializers.ValidationError({'detail': 'Cantidad inválida.'})
                try:
                    p = Product.objects.select_related('punto').get(id=pid, is_active=True, show_in_catalog=True)
                except Product.DoesNotExist:
                    raise serializers.ValidationError({'detail': 'Producto no disponible.'})
                if not p.punto_id:
                    raise serializers.ValidationError({'detail': f'"{p.name}" no tiene punto asignado — contacta a soporte.'})
                # Validación informativa: el stock mostrado viene de TNS y puede
                # haber cambiado desde el último sync. NUNCA se descuenta aquí.
                if p.stock < qty:
                    raise serializers.ValidationError({'detail': f'Stock insuficiente para "{p.name}". Disponible: {p.stock}.'})
                by_punto[p.punto_id].append((p, qty))

            subtotal_total = sum(p.effective_price * qty for group in by_punto.values() for p, qty in group)

            discount_pct = Decimal('0')
            coupon_obj = None
            if coupon:
                try:
                    coupon_obj = Coupon.objects.get(code=coupon)
                except Coupon.DoesNotExist:
                    raise serializers.ValidationError({'coupon_code': 'Cupón inválido.'})
                valid, reason = coupon_obj.is_valid_now(subtotal=subtotal_total)
                if not valid:
                    raise serializers.ValidationError({'coupon_code': reason})
                discount_pct = coupon_obj.discount_pct
            discount_amount = (subtotal_total * discount_pct / 100).quantize(Decimal('0.01'))
            total = subtotal_total - discount_amount

            session = CheckoutSession.objects.create(
                customer          = request.user,
                shipping_name     = str(address.get('full_name', ''))[:200],
                shipping_phone    = str(address.get('phone', ''))[:30],
                shipping_address  = str(address.get('address', ''))[:400],
                shipping_city     = str(address.get('city', ''))[:120],
                shipping_notes    = str(address.get('notes', ''))[:500],
                document_type     = str(address.get('document_type', ''))[:5],
                document_number   = str(address.get('document_number', ''))[:30],
                requires_shipping = bool(validated_data.get('requires_shipping')),
                subtotal          = subtotal_total,
                discount_amount   = discount_amount,
                discount_pct      = discount_pct,
                coupon_code       = coupon,
                total             = total,
            )

            # Si el cliente todavía no tiene documento guardado en su perfil,
            # se lo completamos con lo capturado en este checkout — así el
            # próximo pedido no lo vuelve a pedir, y ya queda listo para
            # crear el Tercero en TNS.
            if not request.user.document_number and session.document_number:
                request.user.document_type = session.document_type
                request.user.document_number = session.document_number
                request.user.save(update_fields=['document_type', 'document_number'])

            # 2. Una Order por punto, con descuento proporcional aplicado a su subtotal
            for punto_id, group in by_punto.items():
                punto_subtotal = sum(p.effective_price * qty for p, qty in group)
                punto_discount = (punto_subtotal * discount_pct / 100).quantize(Decimal('0.01'))
                order = Order.objects.create(
                    checkout_session = session,
                    punto_id         = punto_id,
                    customer         = request.user,
                    subtotal         = punto_subtotal,
                    total            = punto_subtotal - punto_discount,
                )
                for p, qty in group:
                    OrderItem.objects.create(order=order, product=p, unit_price=p.effective_price, quantity=qty)
                    # SIN descuento de stock — el stock real se maneja en TNS.

            Payment.objects.create(checkout_session=session, amount=total, currency='COP')

        if idempotency_key:
            from django.core.cache import cache as _c2
            _c2.set(f'checkout_idem:{idempotency_key}', str(session.id), 86400)
        return session
