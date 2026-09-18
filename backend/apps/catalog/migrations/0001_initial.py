from decimal import Decimal
import uuid
import django.db.models.deletion
from django.db import migrations, models
from django.core.validators import MinValueValidator, MaxValueValidator


def seed_puntos(apps, schema_editor):
    Punto = apps.get_model('catalog', 'Punto')
    Punto.objects.bulk_create([
        Punto(name='Telefonía', slug='telefonia', order=1),
        Punto(name='Repuestos', slug='repuestos', order=2),
        Punto(name='Máquinas', slug='maquinas', order=3),
        Punto(name='Accesorios', slug='accesorios', order=4),
        Punto(name='Hogar', slug='hogar', order=5),
    ])


class Migration(migrations.Migration):
    initial = True
    dependencies = [('core', '0001_initial')]
    operations = [
        migrations.CreateModel(name='Punto', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('name', models.CharField(max_length=100)),
            ('slug', models.SlugField(max_length=120, unique=True, blank=True)),
            ('icon', models.CharField(max_length=10, blank=True)),
            ('is_active', models.BooleanField(default=True)),
            ('order', models.PositiveSmallIntegerField(default=0)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
        ], options={'db_table': 'catalog_puntos', 'ordering': ['order', 'name'], 'verbose_name': 'Punto', 'verbose_name_plural': 'Puntos'}),

        migrations.CreateModel(name='PuntoBodegaTNS', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('tns_bodega_id', models.CharField(max_length=50)),
            ('tns_bodega_nombre', models.CharField(max_length=150, blank=True)),
            ('is_active', models.BooleanField(default=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('punto', models.ForeignKey(to='catalog.Punto', on_delete=django.db.models.deletion.CASCADE, related_name='bodegas_tns')),
        ], options={'db_table': 'catalog_punto_bodega_tns'}),
        migrations.AlterUniqueTogether(name='puntobodegatns', unique_together={('punto', 'tns_bodega_id')}),

        migrations.CreateModel(name='Area', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('name', models.CharField(max_length=100)),
            ('slug', models.SlugField(max_length=120, unique=True, blank=True)),
            ('icon', models.CharField(max_length=10, blank=True)),
            ('color', models.CharField(max_length=20, blank=True)),
            ('order', models.PositiveSmallIntegerField(default=0)),
            ('is_active', models.BooleanField(default=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
        ], options={'db_table': 'catalog_areas', 'ordering': ['order', 'name']}),

        migrations.CreateModel(name='Brand', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('name', models.CharField(max_length=100, unique=True)),
            ('slug', models.SlugField(max_length=120, unique=True, blank=True)),
            ('logo', models.ImageField(upload_to='brands/', null=True, blank=True)),
            ('is_active', models.BooleanField(default=True)),
        ], options={'db_table': 'catalog_brands', 'ordering': ['name']}),

        migrations.CreateModel(name='Category', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('name', models.CharField(max_length=100)),
            ('slug', models.SlugField(max_length=120, blank=True)),
            ('order', models.PositiveSmallIntegerField(default=0)),
            ('area', models.ForeignKey(to='catalog.Area', on_delete=django.db.models.deletion.CASCADE, related_name='categories')),
        ], options={'db_table': 'catalog_categories', 'ordering': ['order', 'name']}),
        migrations.AlterUniqueTogether(name='category', unique_together={('area', 'slug')}),

        migrations.CreateModel(name='Subcategory', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('name', models.CharField(max_length=100)),
            ('slug', models.SlugField(max_length=120, blank=True)),
            ('category', models.ForeignKey(to='catalog.Category', on_delete=django.db.models.deletion.CASCADE, related_name='subcategories')),
        ], options={'db_table': 'catalog_subcategories'}),
        migrations.AlterUniqueTogether(name='subcategory', unique_together={('category', 'slug')}),

        migrations.CreateModel(name='Product', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('name', models.CharField(max_length=200)),
            ('slug', models.SlugField(max_length=240, unique=True, blank=True)),
            ('sku', models.CharField(max_length=60, blank=True, db_index=True)),
            ('description', models.TextField(blank=True)),
            ('specs', models.JSONField(default=dict, blank=True)),
            ('price', models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])),
            ('compare_at', models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)),
            ('cost', models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))),
            ('stock', models.IntegerField(default=0)),
            ('min_stock', models.IntegerField(default=3)),
            ('is_active', models.BooleanField(default=True)),
            ('is_featured', models.BooleanField(default=False)),
            ('show_in_catalog', models.BooleanField(default=False, db_index=True)),
            ('views_count', models.PositiveIntegerField(default=0)),
            ('wishlist_count', models.PositiveIntegerField(default=0)),
            ('sold_count', models.PositiveIntegerField(default=0)),
            ('tns_synced_at', models.DateTimeField(null=True, blank=True)),
            ('tns_sync_status', models.CharField(max_length=20, default='pending')),
            ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('punto', models.ForeignKey(to='catalog.Punto', null=True, blank=True, on_delete=django.db.models.deletion.PROTECT, related_name='products')),
            ('brand', models.ForeignKey(to='catalog.Brand', null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, related_name='products')),
            ('category', models.ForeignKey(to='catalog.Category', null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, related_name='products')),
            ('subcategory', models.ForeignKey(to='catalog.Subcategory', null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, related_name='products')),
        ], options={'db_table': 'catalog_products', 'ordering': ['-created_at']}),
        migrations.AddIndex(model_name='product', index=models.Index(fields=['is_active', 'is_featured'], name='prod_feat_idx')),
        migrations.AddIndex(model_name='product', index=models.Index(fields=['stock'], name='prod_stock_idx')),
        migrations.AddIndex(model_name='product', index=models.Index(fields=['punto', 'show_in_catalog'], name='prod_punto_cat_idx')),

        migrations.CreateModel(name='ProductImage', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('image', models.ImageField(upload_to='products/%Y/%m/')),
            ('order', models.PositiveSmallIntegerField(default=0)),
            ('product', models.ForeignKey(to='catalog.Product', on_delete=django.db.models.deletion.CASCADE, related_name='images')),
        ], options={'db_table': 'catalog_product_images', 'ordering': ['order']}),

        migrations.CreateModel(name='Review', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('rating', models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])),
            ('comment', models.TextField(blank=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('product', models.ForeignKey(to='catalog.Product', on_delete=django.db.models.deletion.CASCADE, related_name='reviews')),
            ('user', models.ForeignKey(to='core.User', on_delete=django.db.models.deletion.CASCADE, related_name='reviews')),
        ], options={'db_table': 'catalog_reviews', 'ordering': ['-created_at']}),
        migrations.AlterUniqueTogether(name='review', unique_together={('product', 'user')}),

        migrations.CreateModel(name='TNSSyncLog', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('started_at', models.DateTimeField(auto_now_add=True)),
            ('finished_at', models.DateTimeField(null=True, blank=True)),
            ('status', models.CharField(max_length=20, default='running')),
            ('products_synced', models.PositiveIntegerField(default=0)),
            ('errors_count', models.PositiveIntegerField(default=0)),
            ('error_log', models.TextField(blank=True)),
            ('punto', models.ForeignKey(to='catalog.Punto', null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sync_logs')),
        ], options={'db_table': 'catalog_tns_sync_logs', 'ordering': ['-started_at']}),

        migrations.CreateModel(name='Promotion', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('name', models.CharField(max_length=150)),
            ('discount_pct', models.DecimalField(max_digits=5, decimal_places=2)),
            ('starts_at', models.DateTimeField()),
            ('ends_at', models.DateTimeField()),
            ('is_active', models.BooleanField(default=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('products', models.ManyToManyField(to='catalog.Product', related_name='promotions', blank=True)),
        ], options={'db_table': 'catalog_promotions', 'ordering': ['-created_at']}),

        migrations.CreateModel(name='CatalogImport', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('file_name', models.CharField(max_length=255, blank=True)),
            ('mode', models.CharField(max_length=10, default='replace', choices=[
                ('replace', 'Reemplazar selección del punto'), ('append', 'Agregar a la selección actual'),
            ])),
            ('skus_found', models.PositiveIntegerField(default=0)),
            ('skus_missing', models.PositiveIntegerField(default=0)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('punto', models.ForeignKey(to='catalog.Punto', on_delete=django.db.models.deletion.CASCADE, related_name='catalog_imports')),
            ('uploaded_by', models.ForeignKey(to='core.User', null=True, on_delete=django.db.models.deletion.SET_NULL)),
        ], options={'db_table': 'catalog_imports', 'ordering': ['-created_at']}),

        migrations.RunPython(seed_puntos, reverse_code=migrations.RunPython.noop),
    ]
