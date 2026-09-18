from decimal import Decimal
import uuid
import django.db.models.deletion
from django.db import migrations, models
from django.core.validators import MinValueValidator


def seed_coupons(apps, schema_editor):
    Coupon = apps.get_model('orders', 'Coupon')
    Coupon.objects.bulk_create([
        Coupon(code='BIENVENIDO10', discount_pct=Decimal('10')),
        Coupon(code='KATALOG15', discount_pct=Decimal('15')),
    ])


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ('core', '0001_initial'),
        ('catalog', '0001_initial'),
    ]
    operations = [
        migrations.CreateModel(name='CheckoutSession', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('session_number', models.CharField(max_length=20, unique=True, db_index=True)),
            ('status', models.CharField(max_length=20, default='pending', choices=[
                ('pending', 'Pendiente de pago'), ('paid', 'Pagado'),
                ('cancelled', 'Cancelado'), ('refunded', 'Reembolsado'),
            ])),
            ('shipping_name', models.CharField(max_length=200, blank=True)),
            ('shipping_phone', models.CharField(max_length=30, blank=True)),
            ('shipping_address', models.CharField(max_length=400, blank=True)),
            ('shipping_city', models.CharField(max_length=120, blank=True)),
            ('shipping_notes', models.TextField(blank=True)),
            ('requires_shipping', models.BooleanField(default=False)),
            ('document_type', models.CharField(max_length=5, blank=True)),
            ('document_number', models.CharField(max_length=30, blank=True)),
            ('subtotal', models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))),
            ('discount_amount', models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))),
            ('discount_pct', models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0'))),
            ('coupon_code', models.CharField(max_length=50, blank=True)),
            ('total', models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))),
            ('currency', models.CharField(max_length=3, default='COP')),
            ('wompi_reference', models.CharField(max_length=100, blank=True, null=True, unique=True, db_index=True)),
            ('wompi_transaction_id', models.CharField(max_length=100, blank=True, db_index=True)),
            ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
            ('paid_at', models.DateTimeField(null=True, blank=True)),
            ('cancelled_at', models.DateTimeField(null=True, blank=True)),
            ('customer', models.ForeignKey(to='core.User', on_delete=django.db.models.deletion.PROTECT, related_name='checkout_sessions')),
        ], options={'db_table': 'checkout_sessions', 'ordering': ['-created_at']}),

        migrations.CreateModel(name='Order', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('order_number', models.CharField(max_length=20, unique=True, db_index=True)),
            ('status', models.CharField(max_length=20, default='pending', choices=[
                ('pending', 'Pendiente de pago'), ('paid', 'Pagado — pendiente de facturar en TNS'),
                ('confirmed', 'Confirmado en TNS'), ('shipped', 'Enviado'),
                ('delivered', 'Entregado'), ('cancelled', 'Cancelado'), ('refunded', 'Reembolsado'),
            ])),
            ('subtotal', models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))),
            ('total', models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))),
            ('tns_confirmed', models.BooleanField(default=False)),
            ('tns_confirmation_ref', models.CharField(max_length=100, blank=True)),
            ('tns_confirmed_at', models.DateTimeField(null=True, blank=True)),
            ('invoice_status', models.CharField(max_length=20, default='pending', choices=[
                ('pending', 'Pendiente de generación'), ('generated', 'Factura generada'),
            ])),
            ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('paid_at', models.DateTimeField(null=True, blank=True)),
            ('delivered_at', models.DateTimeField(null=True, blank=True)),
            ('cancelled_at', models.DateTimeField(null=True, blank=True)),
            ('checkout_session', models.ForeignKey(to='orders.CheckoutSession', on_delete=django.db.models.deletion.CASCADE, related_name='orders')),
            ('punto', models.ForeignKey(to='catalog.Punto', on_delete=django.db.models.deletion.PROTECT, related_name='orders')),
            ('customer', models.ForeignKey(to='core.User', on_delete=django.db.models.deletion.PROTECT, related_name='orders')),
            ('advisor', models.ForeignKey(to='core.User', null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, related_name='advised_orders')),
        ], options={'db_table': 'orders', 'ordering': ['-created_at']}),
        migrations.AddIndex(model_name='order', index=models.Index(fields=['customer', 'status'], name='order_cust_status_idx')),
        migrations.AddIndex(model_name='order', index=models.Index(fields=['status', 'created_at'], name='order_status_created_idx')),
        migrations.AddIndex(model_name='order', index=models.Index(fields=['punto', 'status'], name='order_punto_status_idx')),

        migrations.CreateModel(name='OrderItem', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('product_name_snapshot', models.CharField(max_length=200, blank=True)),
            ('unit_price', models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])),
            ('quantity', models.PositiveIntegerField(default=1)),
            ('order', models.ForeignKey(to='orders.Order', on_delete=django.db.models.deletion.CASCADE, related_name='items')),
            ('product', models.ForeignKey(to='catalog.Product', on_delete=django.db.models.deletion.PROTECT, related_name='order_items')),
        ], options={'db_table': 'order_items'}),

        migrations.CreateModel(name='Payment', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('gateway_reference', models.CharField(max_length=200, blank=True, db_index=True)),
            ('amount', models.DecimalField(max_digits=14, decimal_places=2)),
            ('currency', models.CharField(max_length=3, default='COP')),
            ('status', models.CharField(max_length=20, default='requires_payment', choices=[
                ('requires_payment', 'Requiere pago'), ('processing', 'Procesando'),
                ('succeeded', 'Exitoso'), ('failed', 'Fallido'), ('refunded', 'Reembolsado'),
            ])),
            ('raw_webhook', models.JSONField(default=dict, blank=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('checkout_session', models.ForeignKey(to='orders.CheckoutSession', on_delete=django.db.models.deletion.CASCADE, related_name='payments')),
        ], options={'db_table': 'payments', 'ordering': ['-created_at']}),

        migrations.CreateModel(name='Envio', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('carrier', models.CharField(max_length=30, default='interrapidisimo')),
            ('guide_number', models.CharField(max_length=50, db_index=True)),
            ('destination_city', models.CharField(max_length=120, blank=True)),
            ('status', models.CharField(max_length=20, default='creado', choices=[
                ('creado', 'Guía registrada'), ('en_transito', 'En tránsito'),
                ('entregado', 'Entregado'), ('novedad', 'Con novedad'), ('desconocido', 'Sin información aún'),
            ])),
            ('last_status_raw', models.JSONField(default=dict, blank=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('checkout_session', models.ForeignKey(to='orders.CheckoutSession', on_delete=django.db.models.deletion.CASCADE, related_name='envios')),
            ('created_by', models.ForeignKey(to='core.User', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='envios_creados')),
        ], options={'db_table': 'envios', 'ordering': ['-created_at']}),
        migrations.AddIndex(model_name='envio', index=models.Index(fields=['guide_number'], name='envio_guide_idx')),
        migrations.AlterUniqueTogether(name='envio', unique_together={('checkout_session', 'carrier')}),

        migrations.CreateModel(name='EnvioConsulta', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('guide_number', models.CharField(max_length=50, db_index=True)),
            ('found', models.BooleanField(default=False)),
            ('raw_response', models.JSONField(default=dict, blank=True)),
            ('ip_hash', models.CharField(max_length=64, blank=True)),
            ('queried_at', models.DateTimeField(auto_now_add=True, db_index=True)),
            ('envio', models.ForeignKey(to='orders.Envio', null=True, blank=True, on_delete=django.db.models.deletion.CASCADE, related_name='consultas')),
        ], options={'db_table': 'envio_consultas', 'ordering': ['-queried_at']}),

        migrations.CreateModel(name='Coupon', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('code', models.CharField(max_length=30, unique=True, db_index=True)),
            ('discount_pct', models.DecimalField(max_digits=5, decimal_places=2)),
            ('is_active', models.BooleanField(default=True)),
            ('valid_from', models.DateTimeField(null=True, blank=True)),
            ('valid_until', models.DateTimeField(null=True, blank=True)),
            ('max_uses', models.PositiveIntegerField(null=True, blank=True)),
            ('used_count', models.PositiveIntegerField(default=0)),
            ('min_purchase_amount', models.DecimalField(max_digits=14, decimal_places=2, default=0)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('created_by', models.ForeignKey(to='core.User', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+')),
        ], options={'db_table': 'coupons', 'ordering': ['-created_at']}),

        migrations.RunPython(seed_coupons, reverse_code=migrations.RunPython.noop),
    ]
