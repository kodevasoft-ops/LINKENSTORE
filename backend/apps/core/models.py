import uuid
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True
    def _create_user(self, email, password=None, **extra):
        if not email: raise ValueError('Email es obligatorio')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user
    def create_user(self, email, password=None, **extra):
        extra.setdefault('role', 'customer')
        extra.setdefault('is_staff', False)
        extra.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra)
    def create_superuser(self, email, password=None, **extra):
        extra.setdefault('role', 'superadmin')
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        extra.setdefault('is_active', True)
        return self._create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        CUSTOMER              = 'customer',              'Cliente'
        VENDEDOR              = 'vendedor',               'Vendedor'
        ADMINISTRADOR         = 'administrador',          'Administrador'
        SUPERADMIN            = 'superadmin',             'SuperAdministrador'
        TECNICO               = 'tecnico',                'Técnico'
        ADMINISTRADOR_TECNICO = 'administrador_tecnico',  'Administrador Técnico'
        SUPERVISOR            = 'supervisor',              'Supervisor'

    # Roles cuyo alcance está limitado a UN solo punto (empresa interna).
    # superadmin y supervisor ven todo; tecnico/administrador_tecnico operan
    # sobre reparaciones, que no están segmentadas por punto.
    PUNTO_SCOPED_ROLES = (Role.VENDEDOR, Role.ADMINISTRADOR)

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email        = models.EmailField(unique=True, db_index=True)
    first_name   = models.CharField(max_length=100, blank=True)
    last_name    = models.CharField(max_length=100, blank=True)
    phone        = models.CharField(max_length=30, blank=True)
    role         = models.CharField(max_length=25, choices=Role.choices, default=Role.CUSTOMER)
    # punto: obligatorio en la práctica para vendedor/administrador, ignorado
    # para el resto de roles. La validación de "obligatorio si aplica" vive
    # en el serializer/admin, no aquí, para no romper superadmin/supervisor.
    punto        = models.ForeignKey('catalog.Punto', on_delete=models.SET_NULL, null=True, blank=True, related_name='staff')
    # Documento de identidad — necesario para facturación real y para crear
    # el Tercero correspondiente en TNS. Se captura en el primer checkout.
    document_type   = models.CharField(max_length=5, blank=True, choices=[
        ('CC', 'Cédula de ciudadanía'), ('CE', 'Cédula de extranjería'),
        ('NIT', 'NIT'), ('PA', 'Pasaporte'),
    ])
    document_number = models.CharField(max_length=30, blank=True, db_index=True)
    # Sincronización con TNS — evita crear el mismo Tercero dos veces.
    tns_tercero_id  = models.CharField(max_length=50, blank=True)
    tns_synced_at   = models.DateTimeField(null=True, blank=True)
    is_active    = models.BooleanField(default=True)
    is_staff     = models.BooleanField(default=False)
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    objects = UserManager()
    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        db_table = 'users'
        indexes  = [models.Index(fields=['role']), models.Index(fields=['email']), models.Index(fields=['punto', 'role'])]

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip() or self.email

    @property
    def is_punto_scoped(self) -> bool:
        return self.role in self.PUNTO_SCOPED_ROLES

    def get_full_name(self): return self.full_name
    def get_short_name(self): return self.first_name or self.email.split('@')[0]
    def is_locked(self): return bool(self.locked_until and self.locked_until > timezone.now())
    def __str__(self): return f'{self.email} ({self.role})'


class GlobalConfig(models.Model):
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    site_name        = models.CharField(max_length=100, default='Katalog')
    support_email    = models.EmailField(default='soporte@katalog.com')
    maintenance_mode = models.BooleanField(default=False)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'global_config'

    def save(self, *args, **kwargs):
        self.pk = uuid.UUID('00000000-0000-0000-0000-000000000001')
        super().save(*args, **kwargs)

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=uuid.UUID('00000000-0000-0000-0000-000000000001'))
        return obj


class AuditLog(models.Model):
    id         = models.BigAutoField(primary_key=True)
    user       = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    action     = models.CharField(max_length=100)
    detail     = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']
        indexes  = [models.Index(fields=['user', 'created_at'])]
