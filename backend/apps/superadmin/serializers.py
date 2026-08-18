from rest_framework import serializers
from apps.core.models import User, GlobalConfig, AuditLog
from apps.catalog.models import TNSSyncLog

class AdminUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    password  = serializers.CharField(write_only=True, required=False)
    class Meta:
        model  = User
        fields = ['id','email','first_name','last_name','full_name','phone','role','is_active','created_at','password']
        read_only_fields = ['id','created_at']
    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        user.set_password(password) if password else user.set_unusable_password()
        user.save(); return user
    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for k,v in validated_data.items(): setattr(instance, k, v)
        if password: instance.set_password(password)
        instance.save(); return instance

class GlobalConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = GlobalConfig
        fields = ['site_name','support_email','maintenance_mode','updated_at']
        read_only_fields = ['updated_at']

class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True, default='')
    class Meta:
        model = AuditLog
        fields = ['id','user_email','action','detail','ip_address','created_at']

class TNSSyncLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TNSSyncLog
        fields = ['id','started_at','finished_at','status','products_synced','errors_count']
