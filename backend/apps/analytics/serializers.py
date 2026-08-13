from rest_framework import serializers
from .models import SearchEvent, CartEvent, CartAbandonment, CustomerRegistration, DailySummary

class TrackSearchSerializer(serializers.Serializer):
    query         = serializers.CharField(max_length=300)
    results_count = serializers.IntegerField(default=0)
    session_id    = serializers.CharField(max_length=64, required=False, allow_blank=True)
    area_slug     = serializers.CharField(max_length=100, required=False, allow_blank=True)

class TrackPageViewSerializer(serializers.Serializer):
    path       = serializers.CharField(max_length=500)
    referrer   = serializers.CharField(max_length=500, required=False, allow_blank=True)
    session_id = serializers.CharField(max_length=64, required=False, allow_blank=True)

class TrackCartSerializer(serializers.Serializer):
    event_type        = serializers.CharField(max_length=30)
    session_id        = serializers.CharField(max_length=64)
    cart_items_count  = serializers.IntegerField(default=0)
    cart_total        = serializers.DecimalField(max_digits=14, decimal_places=2, default=0)
    area_name         = serializers.CharField(max_length=100, required=False, allow_blank=True)
    inactivity_seconds = serializers.IntegerField(required=False, allow_null=True)

class CartAbandonmentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CartAbandonment
        fields = ['id','cart_total','items_count','status','last_step','abandoned_at','recovery_email_sent']

class DailySummarySerializer(serializers.ModelSerializer):
    class Meta:
        model  = DailySummary
        fields = ['date','unique_visitors','total_page_views','total_searches','carts_created','carts_abandoned','carts_completed','cart_abandonment_rate','new_customers','orders_count','revenue']
