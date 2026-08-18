"""
apps/superadmin/views.py
SECURITY: Todas las vistas requieren [IsAuthenticated, IsSuperAdmin]
No hay endpoint sin doble verificación.
"""
import logging
from django.db.models import Count
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.core.models import User, GlobalConfig, AuditLog
from apps.core.permissions import IsSuperAdmin
from apps.catalog.models import TNSSyncLog, Product
from .serializers import AdminUserSerializer, GlobalConfigSerializer, AuditLogSerializer, TNSSyncLogSerializer

logger = logging.getLogger('katalog.superadmin')

# Shortcut — applied to every view/viewset in this module
SUPERADMIN_PERMS = [IsAuthenticated, IsSuperAdmin]


class AdminUserViewSet(viewsets.ModelViewSet):
    queryset           = User.objects.all().order_by('-created_at')
    serializer_class   = AdminUserSerializer
    permission_classes = SUPERADMIN_PERMS
    http_method_names  = ['get', 'post', 'patch', 'delete', 'head', 'options']

    # ALLOWED roles that can be created/assigned via this endpoint
    # superadmin role can NEVER be assigned via API — only via CLI/DB
    ASSIGNABLE_ROLES = ('advisor', 'technician', 'admin')

    def get_queryset(self):
        qs = super().get_queryset()
        if r := self.request.query_params.get('role'):
            qs = qs.filter(role=r)
        if s := self.request.query_params.get('search'):
            qs = qs.filter(email__icontains=s)
        return qs

    def perform_create(self, serializer):
        role = serializer.validated_data.get('role', 'advisor')
        # PRIV-ESC PROTECTION: never allow creating superadmin via API
        if role == 'superadmin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('No se puede crear superadmin vía API.')
        serializer.save()
        logger.info('[SUPERADMIN] User created: %s role=%s by %s',
                    serializer.validated_data.get('email'), role, self.request.user.email)

    def perform_update(self, serializer):
        role = serializer.validated_data.get('role')
        if role == 'superadmin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('No se puede asignar rol superadmin vía API.')
        serializer.save()
        logger.info('[SUPERADMIN] User updated: %s by %s',
                    serializer.instance.email, self.request.user.email)

    def perform_destroy(self, instance):
        if instance.role == 'superadmin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('No se puede eliminar un superadmin vía API.')
        logger.warning('[SUPERADMIN] User deleted: %s by %s', instance.email, self.request.user.email)
        instance.delete()

    @action(detail=True, methods=['patch'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        if user.role == 'superadmin':
            return Response({'detail': 'No se puede desactivar un superadmin.'}, status=403)
        user.is_active = not user.is_active
        user.save(update_fields=['is_active'])
        logger.info('[SUPERADMIN] User %s active=%s by %s', user.email, user.is_active, request.user.email)
        return Response({'is_active': user.is_active})

    @action(detail=True, methods=['patch'], url_path='set-role')
    def set_role(self, request, pk=None):
        user     = self.get_object()
        new_role = request.data.get('role')
        # PRIV-ESC: only assignable roles allowed
        if new_role not in self.ASSIGNABLE_ROLES:
            return Response({'detail': f'Rol inválido. Permitidos: {self.ASSIGNABLE_ROLES}'}, status=400)
        if user.role == 'superadmin':
            return Response({'detail': 'No se puede cambiar el rol de un superadmin.'}, status=403)
        old_role = user.role
        user.role = new_role
        user.save(update_fields=['role'])
        logger.info('[SUPERADMIN] Role change: %s %s→%s by %s', user.email, old_role, new_role, request.user.email)
        return Response({'role': user.role})


class GlobalConfigView(APIView):
    permission_classes = SUPERADMIN_PERMS

    def get(self, request):
        return Response(GlobalConfigSerializer(GlobalConfig.get()).data)

    def patch(self, request):
        cfg = GlobalConfig.get()
        s = GlobalConfigSerializer(cfg, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        logger.info('[SUPERADMIN] Config updated by %s', request.user.email)
        return Response(s.data)


class AuditLogListView(APIView):
    permission_classes = SUPERADMIN_PERMS

    def get(self, request):
        page     = max(1, int(request.query_params.get('page', 1)))
        per_page = 100
        qs = AuditLog.objects.select_related('user').all()
        total = qs.count()
        items = qs[(page-1)*per_page: page*per_page]
        return Response({
            'count':   total,
            'results': AuditLogSerializer(items, many=True).data,
        })


class TNSSyncStatusView(APIView):
    permission_classes = SUPERADMIN_PERMS

    def get(self, request):
        logs = TNSSyncLog.objects.all()[:20]
        last = logs.first()
        return Response({
            'last_sync':         TNSSyncLogSerializer(last).data if last else None,
            'history':           TNSSyncLogSerializer(logs, many=True).data,
            'pending_products':  Product.objects.filter(tns_sync_status='pending').count(),
            'error_products':    Product.objects.filter(tns_sync_status='error').count(),
        })


class SuperAdminDashboardView(APIView):
    permission_classes = SUPERADMIN_PERMS

    def get(self, request):
        from apps.orders.models import Order, RepairTicket
        users_by_role = dict(
            User.objects.values_list('role').annotate(c=Count('id')).values_list('role', 'c')
        )
        return Response({
            'users_total':            User.objects.count(),
            'users_by_role':          users_by_role,
            'products_total':         Product.objects.filter(is_active=True).count(),
            'products_low_stock':     Product.objects.filter(stock__lte=3, stock__gt=0, is_active=True).count(),
            'products_out_stock':     Product.objects.filter(stock=0, is_active=True).count(),
            'orders_pending_confirm': Order.objects.filter(status='paid', tns_confirmed=False).count(),
            'repairs_active':         RepairTicket.objects.exclude(status__in=['delivered', 'cancelled']).count(),
        })
