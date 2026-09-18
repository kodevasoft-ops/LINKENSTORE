"""
apps/catalog/tests.py
Misma advertencia que apps/orders/tests.py: verificado solo con py_compile,
no ejecutado contra una base de datos real en este entorno.
"""
from decimal import Decimal
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.models import User
from apps.catalog.models import Punto, Product, Promotion, ProductImage


def _auth_client(user) -> APIClient:
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client


class EffectivePriceTests(TestCase):
    """
    Antes de esta corrección, 'Promotion' era un modelo sin ningún efecto —
    se podía crear una promoción y el precio cobrado no cambiaba. Estos
    tests existen específicamente para que eso no vuelva a pasar en silencio.
    """
    def setUp(self):
        self.punto = Punto.objects.create(name='Repuestos', slug='repuestos-test')
        self.product = Product.objects.create(
            name='Pantalla iPhone', sku='PANT-001', price=Decimal('200000'),
            stock=5, punto=self.punto, is_active=True,
        )

    def test_sin_promocion_el_precio_efectivo_es_el_precio_base(self):
        self.assertEqual(self.product.effective_price, self.product.price)

    def test_con_promocion_vigente_el_precio_baja(self):
        Promotion.objects.create(
            name='Descuento pantallas', discount_pct=Decimal('20'),
            starts_at=timezone.now() - timedelta(days=1),
            ends_at=timezone.now() + timedelta(days=1),
        ).products.add(self.product)

        self.assertEqual(self.product.effective_price, Decimal('160000.00'))

    def test_promocion_vencida_no_afecta_el_precio(self):
        Promotion.objects.create(
            name='Promo vieja', discount_pct=Decimal('50'),
            starts_at=timezone.now() - timedelta(days=10),
            ends_at=timezone.now() - timedelta(days=1),  # ya terminó
        ).products.add(self.product)

        self.assertEqual(self.product.effective_price, self.product.price)

    def test_promocion_futura_todavia_no_afecta_el_precio(self):
        Promotion.objects.create(
            name='Promo futura', discount_pct=Decimal('30'),
            starts_at=timezone.now() + timedelta(days=1),  # todavía no empieza
            ends_at=timezone.now() + timedelta(days=10),
        ).products.add(self.product)

        self.assertEqual(self.product.effective_price, self.product.price)

    def test_dos_promociones_vigentes_aplica_el_mayor_descuento(self):
        for pct in (Decimal('10'), Decimal('30')):
            Promotion.objects.create(
                name=f'Promo {pct}%', discount_pct=pct,
                starts_at=timezone.now() - timedelta(days=1),
                ends_at=timezone.now() + timedelta(days=1),
            ).products.add(self.product)

        self.assertEqual(self.product.effective_price, Decimal('140000.00'))  # 200000 * 0.70


class MaxFourImagesTests(TestCase):
    """El límite de 4 fotos por producto es un requisito de negocio explícito — nunca debe poder saltarse."""
    def setUp(self):
        self.punto = Punto.objects.create(name='Máquinas', slug='maquinas-test')
        self.administrador = User.objects.create_user(
            email='admin@test.com', password='ClaveSegura123!', role='administrador', punto=self.punto,
        )
        self.product = Product.objects.create(
            name='Lavadora', sku='LAV-001', price=Decimal('900000'),
            stock=3, punto=self.punto, is_active=True,
        )
        for i in range(4):
            ProductImage.objects.create(product=self.product, order=i)

    def test_quinta_foto_es_rechazada(self):
        client = _auth_client(self.administrador)
        from django.core.files.uploadedfile import SimpleUploadedFile
        fake_image = SimpleUploadedFile('foto.jpg', b'contenido-falso-de-imagen', content_type='image/jpeg')
        response = client.post(f'/api/v1/products/{self.product.slug}/images/', {'image': fake_image}, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.product.images.count(), 4, 'No debe haberse agregado una quinta imagen.')


class CatalogCurationTests(TestCase):
    """El catálogo público SOLO debe mostrar productos con show_in_catalog=True."""
    def setUp(self):
        self.punto = Punto.objects.create(name='Accesorios', slug='accesorios-test2')
        self.visible = Product.objects.create(
            name='Cargador', sku='CARG-01', price=Decimal('30000'),
            stock=10, punto=self.punto, is_active=True, show_in_catalog=True,
        )
        self.oculto = Product.objects.create(
            name='Cable viejo', sku='CABLE-01', price=Decimal('10000'),
            stock=10, punto=self.punto, is_active=True, show_in_catalog=False,
        )

    def test_catalogo_publico_no_muestra_productos_ocultos(self):
        client = APIClient()
        response = client.get('/api/v1/products/')
        slugs = [p['slug'] for p in response.data['results']]
        self.assertIn(self.visible.slug, slugs)
        self.assertNotIn(self.oculto.slug, slugs)
