from rest_framework import serializers
from apps.orders.models import RepairTicket, RepairPart, RepairImage

class RepairPartSerializer(serializers.ModelSerializer):
    subtotal = serializers.ReadOnlyField()
    class Meta:
        model = RepairPart
        fields = ['id','name','quantity','unit_cost','subtotal','created_at']
        read_only_fields = ['id','created_at']

class RepairImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = RepairImage
        fields = ['id','image','caption','created_at']
        read_only_fields = ['id','created_at']

class RepairTicketSerializer(serializers.ModelSerializer):
    status_display   = serializers.CharField(source='get_status_display', read_only=True)
    customer_name    = serializers.SerializerMethodField()
    customer_phone   = serializers.SerializerMethodField()
    technician_name  = serializers.SerializerMethodField()
    parts            = RepairPartSerializer(many=True, read_only=True)
    images           = RepairImageSerializer(many=True, read_only=True)
    parts_total      = serializers.SerializerMethodField()
    class Meta:
        model = RepairTicket
        fields = ['id','ticket_number','status','status_display','customer','customer_name','customer_phone','technician','technician_name','device_type','device_brand','device_model','serial_number','reported_issue','diagnosis_notes','technician_notes','estimated_cost','final_cost','parts_total','parts','images','received_at','updated_at','ready_at','delivered_at']
        read_only_fields = ['id','ticket_number','customer','received_at','updated_at','ready_at','delivered_at']
    def get_customer_name(self, obj): return obj.customer.full_name if obj.customer else ''
    def get_customer_phone(self, obj): return obj.customer.phone if obj.customer else ''
    def get_technician_name(self, obj): return obj.technician.full_name if obj.technician else 'Sin asignar'
    def get_parts_total(self, obj): return sum(p.subtotal for p in obj.parts.all())

class RepairTicketPublicSerializer(serializers.ModelSerializer):
    status_display  = serializers.CharField(source='get_status_display', read_only=True)
    technician_name = serializers.SerializerMethodField()
    class Meta:
        model = RepairTicket
        fields = ['ticket_number','status','status_display','device_type','device_brand','device_model','technician_name','received_at','ready_at','delivered_at']
    def get_technician_name(self, obj): return obj.technician.full_name if obj.technician else 'Sin asignar'
