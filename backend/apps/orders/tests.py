"""
apps/orders/tests.py

NOTA IMPORTANTE: este sandbox de desarrollo no tuvo acceso a red para instalar
Django y ejecutar estas pruebas de verdad — se verificó únicamente que el
archivo compila como Python válido (`python -m py_compile`). Corre
`python manage.py test apps.orders` en tu entorno real antes de confiar en
ellas al 100%; es la única verificación que de verdad importa.

Cubre la lógica de negocio de mayor riesgo:
- Coupon.is_valid_now(): fechas, usos máximos, compra mínima
- CheckoutSession: split correcto por punto, JAMÁS descuenta stock
- Firma de integridad y verificación de webhook de Wompi
- Envio: idempotencia real (no duplica al llamar dos veces)
"""
from decimal import Decimal
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.models import User
from apps.catalog.models import Punto, Product
from apps.orders.models import CheckoutSession, Order, Coupon, Envio
from apps.orders.services.wompi import WompiClient


def _auth_client(user) -> APIClient:
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client


class CouponValidityTests(TestCase):
    def setUp(self):
        self.now = timezone.now()

    def test_cupon_activo_sin_restricciones_es_valido(self):
        coupon = Coupon.objects.create(code='TEST10', discount_pct=Decimal('10'))
        valid, reason = coupon.is_valid_now()
        self.assertTrue(valid)
        self.assertEqual(reason, '')

    def test_cupon_inactivo_es_invalido(self):
        coupon = Coupon.objects.create(code='OFF', discount_pct=Decimal('10'), is_active=False)
        valid, reason = coupon.is_valid_now()
        self.assertFalse(valid)
        self.assertIn('activo', reason)

    def test_cupon_fuera_de_fecha_vigente_es_invalido(self):
        coupon = Coupon.objects.create(
            code='EXPIRADO', discount_pct=Decimal('10'),
            valid_until=self.now - timedelta(days=1),
        )
        valid, reason = coupon.is_valid_now()
        self.assertFalse(valid)
        self.assertIn('expiró', reason)

    def test_cupon_que_agoto_sus_usos_es_invalido(self):
        coupon = Coupon.objects.create(code='LIMITADO', discount_pct=Decimal('10'), max_uses=1, used_count=1)
        valid, reason = coupon.is_valid_now()
        self.assertFalse(valid)
        self.assertIn('límite', reason)

    def test_cupon_con_compra_minima_no_alcanzada_es_invalido(self):
        coupon = Coupon.objects.create(code='MIN100K', discount_pct=Decimal('10'), min_purchase_amount=Decimal('100000'))
        valid, reason = coupon.is_valid_now(subtotal=Decimal('50000'))
        self.assertFalse(valid)
        valid2, _ = coupon.is_valid_now(subtotal=Decimal('150000'))
        self.assertTrue(valid2)


class CheckoutSessionSplitTests(TestCase):
    """
    El caso más crítico del sistema: un carrito con productos de varios
    puntos debe generar UNA Order por punto, ligadas a la MISMA sesión de
    pago, y el stock del producto NUNCA debe descontarse en este paso.
    """
    def setUp(self):
        self.punto_a = Punto.objects.create(name='Telefonía', slug='telefonia-test')
        self.punto_b = Punto.objects.create(name='Accesorios', slug='accesorios-test')
        self.customer = User.objects.create_user(
            email='cliente@test.com', password='ClaveSegura123!', role='customer',
            document_type='CC', document_number='123456789',
        )
        self.product_a = Product.objects.create(
            name='Celular X', sku='CEL-001', price=Decimal('1000000'),
            stock=10, punto=self.punto_a, is_active=True, show_in_catalog=True,
        )
        self.product_b = Product.objects.create(
            name='Forro Y', sku='FOR-001', price=Decimal('50000'),
            stock=20, punto=self.punto_b, is_active=True, show_in_catalog=True,
        )

    def test_carrito_multipunto_genera_una_orden_por_punto(self):
        client = _auth_client(self.customer)
        payload = {
            'items': [
                {'product_id': str(self.product_a.id), 'quantity': 1},
                {'product_id': str(self.product_b.id), 'quantity': 2},
            ],
            'shipping_address': {
                'full_name': 'Cliente Test', 'phone': '3001234567',
                'address': 'Calle falsa 123', 'city': 'Bogotá',
                'document_type': 'CC', 'document_number': '123456789',
            },
        }
        response = client.post('/api/v1/orders/checkout-sessions/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.content)

        session = CheckoutSession.objects.get(id=response.data['id'])
        orders = Order.objects.filter(checkout_session=session)
        self.assertEqual(orders.count(), 2, 'Debe crear exactamente 1 Order por punto involucrado.')
        self.assertEqual({o.punto_id for o in orders}, {self.punto_a.id, self.punto_b.id})

    def test_checkout_nunca_descuenta_stock(self):
        """
        REGLA DE NEGOCIO CRÍTICA: el stock solo se mueve manualmente en TNS.
        Si este test falla, significa que alguien reintrodujo un descuento
        de stock en el checkout — bloquear el deploy inmediatamente.
        """
        stock_antes = self.product_a.stock
        client = _auth_client(self.customer)
        payload = {
            'items': [{'product_id': str(self.product_a.id), 'quantity': 3}],
            'shipping_address': {
                'full_name': 'Cliente Test', 'phone': '3001234567',
                'address': 'Calle falsa 123', 'city': 'Bogotá',
                'document_type': 'CC', 'document_number': '123456789',
            },
        }
        response = client.post('/api/v1/orders/checkout-sessions/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.content)

        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock, stock_antes, 'El stock NO debe cambiar al crear el checkout.')

    def test_no_se_puede_comprar_mas_del_stock_mostrado(self):
        client = _auth_client(self.customer)
        payload = {
            'items': [{'product_id': str(self.product_a.id), 'quantity': 999}],
            'shipping_address': {
                'full_name': 'Cliente Test', 'phone': '3001234567',
                'address': 'Calle falsa 123', 'city': 'Bogotá',
                'document_type': 'CC', 'document_number': '123456789',
            },
        }
        response = client.post('/api/v1/orders/checkout-sessions/', payload, format='json')
        self.assertEqual(response.status_code, 400)


class WompiSignatureTests(TestCase):
    def setUp(self):
        self.client_obj = WompiClient()
        self.client_obj.integrity_secret = 'secreto-de-prueba'
        self.client_obj.events_secret = 'secreto-eventos-prueba'

    def test_firma_de_integridad_es_deterministica(self):
        sig1 = self.client_obj.build_checkout_signature('REF-001', 100000, 'COP')
        sig2 = self.client_obj.build_checkout_signature('REF-001', 100000, 'COP')
        self.assertEqual(sig1, sig2, 'La misma referencia/monto debe producir siempre la misma firma.')

    def test_firma_cambia_si_el_monto_cambia(self):
        sig1 = self.client_obj.build_checkout_signature('REF-001', 100000, 'COP')
        sig2 = self.client_obj.build_checkout_signature('REF-001', 999999, 'COP')
        self.assertNotEqual(sig1, sig2, 'Si el monto cambia, la firma DEBE cambiar (o alguien podría manipular el precio).')

    def test_webhook_con_firma_invalida_se_rechaza(self):
        payload = {
            'data': {'transaction': {'id': 'tx1', 'status': 'APPROVED'}},
            'timestamp': 1234567890,
            'signature': {'checksum': 'firma-inventada-incorrecta', 'properties': ['transaction.id']},
        }
        self.assertFalse(self.client_obj.verify_webhook_signature(payload))

    def test_webhook_con_firma_valida_se_acepta(self):
        import hashlib
        timestamp = 1234567890
        concat = 'tx1'  # valor de transaction.id
        expected = hashlib.sha256(f'{concat}{timestamp}{self.client_obj.events_secret}'.encode()).hexdigest()
        payload = {
            'data': {'transaction': {'id': 'tx1', 'status': 'APPROVED'}},
            'timestamp': timestamp,
            'signature': {'checksum': expected, 'properties': ['transaction.id']},
        }
        self.assertTrue(self.client_obj.verify_webhook_signature(payload))


class EnvioIdempotencyTests(TestCase):
    def setUp(self):
        self.punto = Punto.objects.create(name='Hogar', slug='hogar-test')
        self.customer = User.objects.create_user(email='c2@test.com', password='ClaveSegura123!', role='customer')
        self.vendedor = User.objects.create_user(
            email='v2@test.com', password='ClaveSegura123!', role='vendedor', punto=self.punto,
        )
        self.session = CheckoutSession.objects.create(customer=self.customer, total=Decimal('100000'))

    def test_registrar_guia_dos_veces_no_duplica(self):
        client = _auth_client(self.vendedor)
        payload = {'checkout_session_id': str(self.session.id), 'guide_number': 'GUIA-001', 'destination_city': 'Medellín'}

        r1 = client.post('/api/v1/orders/envios/', payload, format='json')
        self.assertEqual(r1.status_code, 201)

        # Segunda llamada, con la guía corregida — debe ACTUALIZAR, no duplicar.
        payload['guide_number'] = 'GUIA-001-CORREGIDA'
        r2 = client.post('/api/v1/orders/envios/', payload, format='json')
        self.assertEqual(r2.status_code, 200, 'La segunda vez debe ser un 200 (actualiza), no un 201 (crea de nuevo).')

        self.assertEqual(Envio.objects.filter(checkout_session=self.session).count(), 1,
                          'Debe existir solo UN Envio para esta sesión, sin importar cuántas veces se llame.')
        self.assertEqual(Envio.objects.get(checkout_session=self.session).guide_number, 'GUIA-001-CORREGIDA')
