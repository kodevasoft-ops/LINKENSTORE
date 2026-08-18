from decimal import Decimal
from django.db import migrations, models
import django.db.models.deletion
import uuid

class Migration(migrations.Migration):
    initial = True
    dependencies = [('core', '0001_initial')]
    operations = [
        migrations.CreateModel('Area', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('name', models.CharField(max_length=100)),
            ('slug', models.SlugField(max_length=120, unique=True, blank=True)),
            ('icon', models.CharField(max_length=10, blank=True)),
            ('color', models.CharField(max_length=20, blank=True)),
            ('order', models.PositiveSmallIntegerField(default=0)),
            ('is_active', models.BooleanField(default=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
        ], options={'db_table': 'catalog_areas', 'ordering': ['order', 'name']}),

        migrations.CreateModel('Brand', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('name', models.CharField(max_length=100, unique=True)),
            ('slug', models.SlugField(max_length=120, unique=True, blank=True)),
            ('logo', models.ImageField(upload_to='brands/', null=True, blank=True)),
            ('is_active', models.BooleanField(default=True)),
        ], options={'db_table': 'catalog_brands', 'ordering': ['name']}),

        migrations.CreateModel('Category', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('name', models.CharField(max_length=100)),
            ('slug', models.SlugField(max_length=120, blank=True)),
            ('order', models.PositiveSmallIntegerField(default=0)),
            ('area', models.ForeignKey(to='catalog.Area', on_delete=django.db.models.deletion.CASCADE, related_name='categories')),
        ], options={'db_table': 'catalog_categories', 'ordering': ['order', 'name']}),
        migrations.AlterUniqueTogether(name='category', unique_together={('area', 'slug')}),

        migrations.CreateModel('Subcategory', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('name', models.CharField(max_length=100)),
            ('slug', models.SlugField(max_length=120, blank=True)),
            ('category', models.ForeignKey(to='catalog.Category', on_delete=django.db.models.deletion.CASCADE, related_name='subcategories')),
        ], options={'db_table': 'catalog_subcategories'}),
        migrations.AlterUniqueTogether(name='subcategory', unique_together={('category', 'slug')}),

        migrations.CreateModel('Product', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('name', models.CharField(max_length=200)),
            ('slug', models.SlugField(max_length=240, unique=True, blank=True)),
            ('sku', models.CharField(max_length=60, blank=True, db_index=True)),
            ('description', models.TextField(blank=True)),
            ('specs', models.JSONField(default=dict, blank=True)),
            ('price', models.DecimalField(max_digits=14, decimal_places=2)),
            ('compare_at', models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)),
            ('cost', models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))),
            ('stock', models.IntegerField(default=0)),
            ('min_stock', models.IntegerField(default=3)),
            ('is_active', models.BooleanField(default=True)),
            ('is_featured', models.BooleanField(default=False)),
            ('views_count', models.PositiveIntegerField(default=0)),
            ('wishlist_count', models.PositiveIntegerField(default=0)),
            ('sold_count', models.PositiveIntegerField(default=0)),
            ('tns_synced_at', models.DateTimeField(null=True, blank=True)),
            ('tns_sync_status', models.CharField(max_length=20, default='pending')),
            ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('brand', models.ForeignKey(to='catalog.Brand', null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, related_name='products')),
            ('category', models.ForeignKey(to='catalog.Category', null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, related_name='products')),
            ('subcategory', models.ForeignKey(to='catalog.Subcategory', null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, related_name='products')),
        ], options={'db_table': 'catalog_products', 'ordering': ['-created_at']}),
        migrations.AddIndex(model_name='product', index=models.Index(fields=['is_active', 'is_featured'], name='prod_feat_idx')),
        migrations.AddIndex(model_name='product', index=models.Index(fields=['stock'], name='prod_stock_idx')),

        migrations.CreateModel('ProductImage', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('image', models.ImageField(upload_to='products/%Y/%m/')),
            ('order', models.PositiveSmallIntegerField(default=0)),
            ('product', models.ForeignKey(to='catalog.Product', on_delete=django.db.models.deletion.CASCADE, related_name='images')),
        ], options={'db_table': 'catalog_product_images', 'ordering': ['order']}),

        migrations.CreateModel('Review', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('rating', models.PositiveSmallIntegerField()),
            ('comment', models.TextField(blank=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('product', models.ForeignKey(to='catalog.Product', on_delete=django.db.models.deletion.CASCADE, related_name='reviews')),
            ('user', models.ForeignKey(to='core.User', on_delete=django.db.models.deletion.CASCADE, related_name='reviews')),
        ], options={'db_table': 'catalog_reviews', 'ordering': ['-created_at']}),
        migrations.AlterUniqueTogether(name='review', unique_together={('product', 'user')}),

        migrations.CreateModel('TNSSyncLog', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('started_at', models.DateTimeField(auto_now_add=True)),
            ('finished_at', models.DateTimeField(null=True, blank=True)),
            ('status', models.CharField(max_length=20, default='running')),
            ('products_synced', models.PositiveIntegerField(default=0)),
            ('errors_count', models.PositiveIntegerField(default=0)),
            ('error_log', models.TextField(blank=True)),
        ], options={'db_table': 'catalog_tns_sync_logs', 'ordering': ['-started_at']}),

        migrations.CreateModel('Promotion', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('name', models.CharField(max_length=150)),
            ('discount_pct', models.DecimalField(max_digits=5, decimal_places=2)),
            ('starts_at', models.DateTimeField()),
            ('ends_at', models.DateTimeField()),
            ('is_active', models.BooleanField(default=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
        ], options={'db_table': 'catalog_promotions', 'ordering': ['-created_at']}),
        migrations.AddField(
            model_name='promotion',
            name='products',
            field=models.ManyToManyField(to='catalog.Product', related_name='promotions', blank=True),
        ),
    ]
