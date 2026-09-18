import uuid
import django.db.models.deletion
from django.db import migrations, models
import apps.core.fields


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('core', '0002_add_punto'),
        ('orders', '0001_initial'),
        ('analytics', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='WhatsAppConfig',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
                ('is_active', models.BooleanField(default=False)),
                ('api_key', apps.core.fields.EncryptedCharField(blank=True)),
                ('phone_display_name', models.CharField(max_length=100, blank=True)),
                ('webhook_basic_auth_user', models.CharField(max_length=100, blank=True)),
                ('webhook_basic_auth_pass', apps.core.fields.EncryptedCharField(blank=True)),
                ('respond_on_message', models.BooleanField(default=True)),
                ('cart_reminder_enabled', models.BooleanField(default=True)),
                ('cart_reminder_delay_minutes', models.PositiveIntegerField(default=60)),
                ('followup_enabled', models.BooleanField(default=True)),
                ('followup_delay_hours', models.PositiveIntegerField(default=24)),
                ('order_confirmation_enabled', models.BooleanField(default=True)),
                ('activated_at', models.DateTimeField(null=True, blank=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('activated_by', models.ForeignKey(to='core.User', null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+')),
            ],
            options={'db_table': 'whatsapp_config', 'verbose_name': 'Configuración de WhatsApp'},
        ),
        migrations.CreateModel(
            name='WhatsAppConversation',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
                ('phone_number', models.CharField(max_length=30, unique=True, db_index=True)),
                ('wa_id', models.CharField(max_length=50, blank=True)),
                ('contact_name', models.CharField(max_length=150, blank=True)),
                ('last_inbound_at', models.DateTimeField(null=True, blank=True)),
                ('last_outbound_at', models.DateTimeField(null=True, blank=True)),
                ('awaiting_customer_reply', models.BooleanField(default=False)),
                ('followup_sent_at', models.DateTimeField(null=True, blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('customer', models.ForeignKey(to='core.User', null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, related_name='whatsapp_conversations')),
            ],
            options={'db_table': 'whatsapp_conversations', 'ordering': ['-updated_at']},
        ),
        migrations.CreateModel(
            name='WhatsAppMessage',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
                ('direction', models.CharField(max_length=10, choices=[('inbound', 'Recibido'), ('outbound', 'Enviado')])),
                ('trigger', models.CharField(max_length=20, default='manual', choices=[
                    ('manual', 'Manual'), ('auto_reply', 'Respuesta automática'),
                    ('cart_reminder', 'Recordatorio de carrito'), ('follow_up', 'Seguimiento (preguntó y se fue)'),
                    ('order_confirm', 'Confirmación de venta'), ('customer', 'Mensaje del cliente'),
                ])),
                ('message_type', models.CharField(max_length=20, default='text')),
                ('template_name', models.CharField(max_length=100, blank=True)),
                ('body', models.TextField(blank=True)),
                ('status', models.CharField(max_length=20, default='queued', choices=[
                    ('queued', 'En cola'), ('sent', 'Enviado'), ('delivered', 'Entregado'),
                    ('read', 'Leído'), ('failed', 'Fallido'),
                ])),
                ('wa_message_id', models.CharField(max_length=100, blank=True, db_index=True)),
                ('raw_payload', models.JSONField(default=dict, blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('conversation', models.ForeignKey(to='whatsapp.WhatsAppConversation', on_delete=django.db.models.deletion.CASCADE, related_name='messages')),
                ('related_checkout_session', models.ForeignKey(to='orders.CheckoutSession', null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, related_name='whatsapp_messages')),
                ('related_cart_abandonment', models.ForeignKey(to='analytics.CartAbandonment', null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, related_name='whatsapp_messages')),
            ],
            options={'db_table': 'whatsapp_messages', 'ordering': ['-created_at']},
        ),
        migrations.AddIndex(
            model_name='whatsappmessage',
            index=models.Index(fields=['conversation', 'created_at'], name='wa_msg_conv_created_idx'),
        ),
    ]
