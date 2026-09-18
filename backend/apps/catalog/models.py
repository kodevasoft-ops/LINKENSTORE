import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from django.utils.text import slugify
from django.core.validators import MinValueValidator, MaxValueValidator


class Punto(models.Model):
    """
    Empresa interna / punto de venta (Telefonía, Repuestos, Máquinas, Accesorios, Hogar).
    Cada punto tiene su propio inventario en TNS y su propio equipo de
    administrador + vendedor(es) — no ven ni gestionan productos de otros puntos.
    El catálogo público SÍ muestra todos los puntos juntos y unificados.
    """
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name       = models.CharField(max_length=100)
    slug       = models.SlugField(max_length=120, unique=True, blank=True)
    icon       = models.CharField(max_length=10, blank=True)
    is_active  = models.BooleanField(default=True)
    order      = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'catalog_puntos'
        ordering = ['order', 'name']
        verbose_name = 'Punto'
        verbose_name_plural = 'Puntos'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class PuntoBodegaTNS(models.Model):
    """
    Mapeo entre un Punto interno y una o más Bodegas de TNS
    (GET /v2/tablas/Bodega/ObtenerBodegas). Configurable desde el panel de
    SuperAdmin porque todavía no está confirmado el identificador exacto
    que TNS usa para separar "empresas internas" — así no dependemos de
    adivinar el nombre del campo, cualquier ID de bodega se puede vincular.
    """
    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    punto             = models.ForeignKey(Punto, on_delete=models.CASCADE, related_name='bodegas_tns')
    tns_bodega_id     = models.CharField(max_length=50)
    tns_bodega_nombre = models.CharField(max_length=150, blank=True)  # informativo, cacheado del último sync
    is_active         = models.BooleanField(default=True)
    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'catalog_punto_bodega_tns'
        unique_together = [['punto', 'tns_bodega_id']]

    def __str__(self):
        return f'{self.punto.name} ↔ Bodega {self.tns_bodega_id}'


class Area(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name       = models.CharField(max_length=100)
    slug       = models.SlugField(max_length=120, unique=True, blank=True)
    icon       = models.CharField(max_length=10, blank=True)
    color      = models.CharField(max_length=20, blank=True)
    order      = models.PositiveSmallIntegerField(default=0)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'catalog_areas'
        ordering = ['order', 'name']
    def save(self, *args, **kwargs):
        if not self.slug: self.slug = slugify(self.name)
        super().save(*args, **kwargs)
    def __str__(self): return self.name


class Brand(models.Model):
    id        = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name      = models.CharField(max_length=100, unique=True)
    slug      = models.SlugField(max_length=120, unique=True, blank=True)
    logo      = models.ImageField(upload_to='brands/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    class Meta:
        db_table = 'catalog_brands'
        ordering = ['name']
    def save(self, *args, **kwargs):
        if not self.slug: self.slug = slugify(self.name)
        super().save(*args, **kwargs)
    def __str__(self): return self.name


class Category(models.Model):
    id    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    area  = models.ForeignKey(Area, on_delete=models.CASCADE, related_name='categories')
    name  = models.CharField(max_length=100)
    slug  = models.SlugField(max_length=120, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    class Meta:
        db_table = 'catalog_categories'
        ordering = ['order', 'name']
        unique_together = [['area', 'slug']]
    def save(self, *args, **kwargs):
        if not self.slug: self.slug = slugify(self.name)
        super().save(*args, **kwargs)
    def __str__(self): return f'{self.area.name} / {self.name}'


class Subcategory(models.Model):
    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='subcategories')
    name     = models.CharField(max_length=100)
    slug     = models.SlugField(max_length=120, blank=True)
    class Meta:
        db_table = 'catalog_subcategories'
        unique_together = [['category', 'slug']]
    def save(self, *args, **kwargs):
        if not self.slug: self.slug = slugify(self.name)
        super().save(*args, **kwargs)
    def __str__(self): return self.name


class Product(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Punto: temporalmente NULLABLE — los productos ya existentes en la BD no
    # tienen punto asignado todavía. Una vez asignados manualmente desde el
    # panel de SuperAdmin, una migración de seguimiento debe volverlo NOT NULL.
    punto       = models.ForeignKey(Punto, on_delete=models.PROTECT, related_name='products', null=True, blank=True)
    name        = models.CharField(max_length=200)
    slug        = models.SlugField(max_length=240, unique=True, blank=True)
    sku         = models.CharField(max_length=60, blank=True, db_index=True)
    brand       = models.ForeignKey(Brand, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    category    = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    subcategory = models.ForeignKey(Subcategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    description = models.TextField(blank=True)
    specs       = models.JSONField(default=dict, blank=True)
    price       = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    compare_at  = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    cost        = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    stock       = models.IntegerField(default=0)
    min_stock   = models.IntegerField(default=3)
    is_active   = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    # show_in_catalog: distinto de is_active — is_active refleja si sigue vigente en TNS,
    # show_in_catalog es la curación manual (o vía Excel) de qué se muestra en la web pública.
    show_in_catalog = models.BooleanField(default=False, db_index=True)
    views_count    = models.PositiveIntegerField(default=0)
    wishlist_count = models.PositiveIntegerField(default=0)
    sold_count     = models.PositiveIntegerField(default=0)
    tns_synced_at   = models.DateTimeField(null=True, blank=True)
    tns_sync_status = models.CharField(max_length=20, default='pending')
    created_at  = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at  = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'catalog_products'
        ordering = ['-created_at']
        indexes  = [
            models.Index(fields=['is_active', 'is_featured']),
            models.Index(fields=['stock']),
            models.Index(fields=['punto', 'show_in_catalog']),
        ]
    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name); slug = base; n = 1
            while Product.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                n += 1; slug = f'{base}-{n}'
            self.slug = slug
        super().save(*args, **kwargs)
    @property
    def main_image(self):
        first = self.images.order_by('order').first()
        return first.image.url if first else None
    @property
    def rating_avg(self):
        agg = self.reviews.aggregate(avg=models.Avg('rating'))
        return round(agg['avg'] or 0, 1)
    @property
    def discount_pct(self):
        if self.compare_at and self.compare_at > self.price:
            return round((1 - self.price / self.compare_at) * 100)
        return 0

    @property
    def active_promotion(self):
        """La promoción vigente (si hay alguna) — un solo lugar con toda la regla de vigencia."""
        now = timezone.now()
        return self.promotions.filter(is_active=True, starts_at__lte=now, ends_at__gte=now).order_by('-discount_pct').first()

    @property
    def effective_price(self):
        """
        Precio final que paga el cliente: aplica la promoción activa con
        mayor descuento sobre el precio base, si existe alguna vigente.
        Antes 'Promotion' era un modelo sin ningún efecto real — esto lo conecta.
        """
        promo = self.active_promotion
        if promo:
            return (self.price * (1 - promo.discount_pct / 100)).quantize(Decimal('0.01'))
        return self.price

    def __str__(self): return self.name


class ProductImage(models.Model):
    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image   = models.ImageField(upload_to='products/%Y/%m/')
    order   = models.PositiveSmallIntegerField(default=0)
    class Meta:
        db_table = 'catalog_product_images'
        ordering = ['order']


class Review(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product    = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user       = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='reviews')
    rating     = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment    = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'catalog_reviews'
        ordering = ['-created_at']
        unique_together = [['product', 'user']]


class TNSSyncLog(models.Model):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    punto           = models.ForeignKey(Punto, on_delete=models.SET_NULL, null=True, blank=True, related_name='sync_logs')
    started_at      = models.DateTimeField(auto_now_add=True)
    finished_at     = models.DateTimeField(null=True, blank=True)
    status          = models.CharField(max_length=20, default='running')
    products_synced = models.PositiveIntegerField(default=0)
    errors_count    = models.PositiveIntegerField(default=0)
    error_log       = models.TextField(blank=True)
    class Meta:
        db_table = 'catalog_tns_sync_logs'
        ordering = ['-started_at']


class Promotion(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name         = models.CharField(max_length=150)
    products     = models.ManyToManyField(Product, related_name='promotions', blank=True)
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2)
    starts_at    = models.DateTimeField()
    ends_at      = models.DateTimeField()
    is_active    = models.BooleanField(default=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'catalog_promotions'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} (-{self.discount_pct}%)'


class CatalogImport(models.Model):
    """
    Historial de importaciones de Excel para curar qué productos aparecen
    en el catálogo público. Cada fila del Excel con un SKU existente marca
    ese producto con show_in_catalog=True; los que no aparecen en el Excel
    más reciente de su punto se marcan en False (a menos que sea "agregar").
    """
    class Mode(models.TextChoices):
        REPLACE = 'replace', 'Reemplazar selección del punto'
        APPEND  = 'append',  'Agregar a la selección actual'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    punto        = models.ForeignKey(Punto, on_delete=models.CASCADE, related_name='catalog_imports')
    uploaded_by  = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True)
    file_name    = models.CharField(max_length=255, blank=True)
    mode         = models.CharField(max_length=10, choices=Mode.choices, default=Mode.REPLACE)
    skus_found   = models.PositiveIntegerField(default=0)
    skus_missing = models.PositiveIntegerField(default=0)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'catalog_imports'
        ordering = ['-created_at']
