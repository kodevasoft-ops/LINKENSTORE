from django.db import migrations, models
import django.db.models.deletion
import uuid

class Migration(migrations.Migration):
    initial = True
    dependencies = [('auth', '0012_alter_user_first_name_max_length')]
    operations = [
        migrations.CreateModel(name='User', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('password', models.CharField(max_length=128)),
            ('last_login', models.DateTimeField(null=True, blank=True)),
            ('is_superuser', models.BooleanField(default=False)),
            ('email', models.EmailField(unique=True, db_index=True)),
            ('first_name', models.CharField(max_length=100, blank=True)),
            ('last_name', models.CharField(max_length=100, blank=True)),
            ('phone', models.CharField(max_length=30, blank=True)),
            ('role', models.CharField(max_length=20, default='customer')),
            ('is_active', models.BooleanField(default=True)),
            ('is_staff', models.BooleanField(default=False)),
            ('failed_login_attempts', models.PositiveSmallIntegerField(default=0)),
            ('locked_until', models.DateTimeField(null=True, blank=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('groups', models.ManyToManyField(blank=True, to='auth.group', related_name='katalog_users')),
            ('user_permissions', models.ManyToManyField(blank=True, to='auth.permission', related_name='katalog_users')),
        ], options={'db_table': 'users'}),
        migrations.CreateModel(name='GlobalConfig', fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
            ('site_name', models.CharField(max_length=100, default='Katalog')),
            ('support_email', models.EmailField(default='soporte@katalog.com')),
            ('maintenance_mode', models.BooleanField(default=False)),
            ('updated_at', models.DateTimeField(auto_now=True)),
        ], options={'db_table': 'global_config'}),
        migrations.CreateModel(name='AuditLog', fields=[
            ('id', models.BigAutoField(primary_key=True)),
            ('action', models.CharField(max_length=100)),
            ('detail', models.JSONField(default=dict, blank=True)),
            ('ip_address', models.GenericIPAddressField(null=True, blank=True)),
            ('user_agent', models.CharField(max_length=300, blank=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('user', models.ForeignKey(to='core.User', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='audit_logs')),
        ], options={'db_table': 'audit_logs', 'ordering': ['-created_at']}),
    ]
