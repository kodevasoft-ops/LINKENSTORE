from decimal import Decimal
from rest_framework import serializers
from django.db import transaction
from apps.catalog.models import Product
from .models import Order, OrderItem, Payment

class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product_name_snapshot', read_only=True)
    subtotal     = serializers.ReadOnlyField()
    class Meta:
        model  = OrderItem
        fields = ['id','product_name','unit_price','quantity','subtotal']

class OrderSerializer(serializers.ModelSerializer):
    items          = OrderItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    customer_name  = serializers.SerializerMethodField()
    class Meta:
        model  = Order
        fields = ['id','order_number','status','status_display','customer_name',
                  'shipping_name','shipping_phone','shipping_address','shipping_city','shipping_notes',
                  'subtotal','discount_amount','discount_pct','coupon_code','total',
                  'tns_confirmed','tns_confirmation_ref','items','created_at','paid_at']
        read_only_fields = ['id','order_number','status','subtotal','total',
                            'tns_confirmed','created_at','paid_at']
    def get_customer_name(self, obj): return obj.customer.full_name if obj.customer else ''

class OrderDetailSerializer(OrderSerializer):
    # client_secret only shown in detail view — never in list
    client_secret = serializers.CharField(source='stripe_client_secret', read_only=True)
    class Meta(OrderSerializer.Meta):
        fields = OrderSerializer.Meta.fields + ['client_secret']

class OrderCreateSerializer(serializers.Serializer):
    items            = serializers.ListField(child=serializers.DictField(), min_length=1, max_length=50)
    shipping_address = serializers.DictField()
    coupon_code      = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=50)

    COUPONS = {'BIENVENIDO10': Decimal('10'), 'KATALOG15': Decimal('15')}

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('La orden debe tener al menos 1 producto.')
        return items

    def create(self, validated_data):
        import stripe
        from django.conf import settings as dj_settings
        request  = self.context['request']
        items_in = validated_data['items']
        address  = validated_data['shipping_address']
        coupon   = (validated_data.get('coupon_code') or '').strip().upper()

        # IDEMPOTENCY: prevent double-submit
        idempotency_key = self.context['request'].META.get('HTTP_IDEMPOTENCY_KEY', '')
        if idempotency_key:
            from django.core.cache import cache as _c
            eid = _c.get(f'order_idem:{idempotency_key}')
            if eid:
                try:
                    return Order.objects.get(id=eid)
                except Order.DoesNotExist:
                    pass

        with transaction.atomic():
            product_map = {}
            for item in items_in:
                pid = item.get('product_id')
                qty = int(item.get('quantity', 1))
                if qty < 1 or qty > 50:
                    raise serializers.ValidationError({'detail': 'Cantidad inválida.'})
                try:
                    # select_for_update: lock row — prevents double-spend
                    p = Product.objects.select_for_update().get(id=pid, is_active=True)
                except Product.DoesNotExist:
                    raise serializers.ValidationError({'detail': f'Producto no disponible.'})
                if p.stock < qty:
                    raise serializers.ValidationError({
                        'detail': f'Stock insuficiente para "{p.name}". Disponible: {p.stock}.'
                    })
                product_map[str(p.id)] = (p, qty)

            # Price from DB — NEVER from client request
            subtotal = sum(p.price * qty for p, qty in product_map.values())

            discount_pct = Decimal('0')
            if coupon:
                if coupon not in self.COUPONS:
                    raise serializers.ValidationError({'coupon_code': 'Cupón inválido.'})
                discount_pct = self.COUPONS[coupon]

            discount_amount = (subtotal * discount_pct / 100).quantize(Decimal('0.01'))
            total = subtotal - discount_amount

            order = Order.objects.create(
                customer         = request.user,
                shipping_name    = str(address.get('full_name', ''))[:200],
                shipping_phone   = str(address.get('phone', ''))[:30],
                shipping_address = str(address.get('address', ''))[:400],
                shipping_city    = str(address.get('city', ''))[:120],
                shipping_notes   = str(address.get('notes', ''))[:500],
                subtotal         = subtotal,
                discount_amount  = discount_amount,
                discount_pct     = discount_pct,
                coupon_code      = coupon,
                total            = total,
            )

            for p, qty in product_map.values():
                OrderItem.objects.create(
                    order      = order,
                    product    = p,
                    unit_price = p.price,  # snapshot from DB at purchase time
                    quantity   = qty,
                )
                # Atomic stock decrement
                p.stock -= qty
                p.save(update_fields=['stock'])

            stripe.api_key = dj_settings.STRIPE_SECRET_KEY
            intent = stripe.PaymentIntent.create(
                amount   = int(total * 100),
                currency = 'cop',
                metadata = {'order_id': str(order.id), 'order_number': order.order_number},
                automatic_payment_methods={'enabled': True},
            )
            order.stripe_payment_intent_id = intent.id
            order.stripe_client_secret     = intent.client_secret
            order.save(update_fields=['stripe_payment_intent_id','stripe_client_secret'])
            Payment.objects.create(order=order, stripe_id=intent.id, amount=total,
                                   status=Payment.Status.REQUIRES_PAYMENT)
        if idempotency_key:
            from django.core.cache import cache as _c2
            _c2.set(f'order_idem:{idempotency_key}', str(order.id), 86400)
        return order
