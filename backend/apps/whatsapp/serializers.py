from rest_framework import serializers
from .models import WhatsAppConfig, WhatsAppConversation, WhatsAppMessage


class WhatsAppConfigSerializer(serializers.ModelSerializer):
    has_api_key = serializers.SerializerMethodField()
    activated_by_name = serializers.CharField(source='activated_by.full_name', read_only=True, default='')

    class Meta:
        model = WhatsAppConfig
        fields = [
            'is_active', 'has_api_key', 'api_key', 'phone_display_name',
            'webhook_basic_auth_user', 'webhook_basic_auth_pass',
            'respond_on_message', 'cart_reminder_enabled', 'cart_reminder_delay_minutes',
            'followup_enabled', 'followup_delay_hours', 'order_confirmation_enabled',
            'activated_by_name', 'activated_at', 'updated_at',
        ]
        read_only_fields = ['activated_by_name', 'activated_at', 'updated_at']
        extra_kwargs = {
            'api_key': {'write_only': True, 'required': False},
            'webhook_basic_auth_pass': {'write_only': True, 'required': False},
        }

    def get_has_api_key(self, obj):
        return bool(obj.api_key)


class WhatsAppMessageSerializer(serializers.ModelSerializer):
    trigger_display = serializers.CharField(source='get_trigger_display', read_only=True)
    status_display  = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = WhatsAppMessage
        fields = ['id', 'direction', 'trigger', 'trigger_display', 'message_type',
                  'body', 'status', 'status_display', 'created_at']


class WhatsAppConversationSerializer(serializers.ModelSerializer):
    messages = WhatsAppMessageSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.full_name', read_only=True, default='')

    class Meta:
        model = WhatsAppConversation
        fields = ['id', 'phone_number', 'contact_name', 'customer_name',
                  'last_inbound_at', 'last_outbound_at', 'awaiting_customer_reply',
                  'messages', 'created_at']
