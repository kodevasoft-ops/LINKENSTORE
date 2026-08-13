from django.contrib.auth import get_user_model
from rest_framework import serializers
from apps.core.validators.password import EnterprisePasswordValidator

User = get_user_model()

class LoginSerializer(serializers.Serializer):
    email    = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        email = attrs['email'].lower().strip()
        try:
            user = User.objects.get(email=email, is_active=True)
            # Same message regardless of whether user exists or password wrong (anti-enumeration)
            attrs['user'] = user if user.check_password(attrs['password']) else None
        except User.DoesNotExist:
            attrs['user'] = None  # Same code path, same timing
        return attrs


class RegisterSerializer(serializers.ModelSerializer):
    password         = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model  = User
        # role is intentionally EXCLUDED — always set to 'customer' in create()
        fields = ['first_name', 'last_name', 'email', 'password', 'password_confirm']

    def validate_email(self, v):
        v = v.lower().strip()  # normalize
        if User.objects.filter(email=v).exists():
            raise serializers.ValidationError('Ya existe una cuenta con este correo.')
        return v

    def validate_password(self, v):
        EnterprisePasswordValidator().validate(v)
        return v

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password_confirm'):
            raise serializers.ValidationError({'password_confirm': 'Las contraseñas no coinciden.'})
        return attrs

    def create(self, validated_data):
        validated_data['role'] = 'customer'  # FORCED — never from request
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserMeSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model  = User
        # CRITICAL: 'role' is READ-ONLY and NOT in writeable fields
        # A customer cannot escalate privileges via PATCH /api/v1/auth/me/
        fields          = ['id', 'email', 'first_name', 'last_name', 'full_name', 'phone', 'role', 'created_at']
        read_only_fields = ['id', 'email', 'role', 'created_at']  # role always read-only

    def get_full_name(self, obj):
        return obj.full_name


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_old_password(self, v):
        if not self.context['request'].user.check_password(v):
            raise serializers.ValidationError('Contraseña actual incorrecta.')
        return v

    def validate_new_password(self, v):
        EnterprisePasswordValidator().validate(v)
        return v
