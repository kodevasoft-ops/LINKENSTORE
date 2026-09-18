"""
apps/superadmin/views.py
SECURITY: Todas las vistas requieren [IsAuthenticated, IsSuperAdmin]
No hay endpoint sin doble verificación.
"""
import logging
from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.core.models import User, GlobalConfig, AuditLog
from apps.core.permissions import IsSuperAdmin
from apps.catalog.models import TNSSyncLog, Product, Punto
from .serializers import AdminUserSerializer, GlobalConfigSerializer, AuditLogSerializer, TNSSyncLogSerializer

logger = logging.getLogger('katalog.superadmin')

SUPERADMIN_PERMS = [IsAuthenticated, IsSuperAdmin]


class AdminUserViewSet(viewsets.ModelViewSet):
    queryset           = User.objects.all().order_by('-created_at')
    serializer_class   = AdminUserSerializer
    permission_classes = SUPERADMIN_PERMS
    http_method_names  = ['get', 'post', 'patch', 'delete', 'head', 'options']

    # Roles asignables vía API — superadmin NUNCA se asigna por API (solo CLI/DB directo)
    ASSIGNABLE_ROLES = ('vendedor', 'administrador', 'tecnico', 'administrador_tecnico', 'supervisor')

    def get_queryset(self):
        qs = super().get_queryset()
        if r := self.request.query_params.get('role'):
            qs = qs.filter(role=r)
        if p := self.request.query_params.get('punto'):
            qs = qs.filter(punto__slug=p)
        if s := self.request.query_params.get('search'):
            qs = qs.filter(email__icontains=s)
        return qs

    def perform_create(self, serializer):
        role = serializer.validated_data.get('role', 'vendedor')
        if role == 'superadmin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('No se puede crear superadmin vía API.')
        if role in ('vendedor', 'administrador') and not serializer.validated_data.get('punto'):
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'punto': 'Vendedor y Administrador requieren un punto asignado.'})
        serializer.save()
        logger.info('[SUPERADMIN] Usuario creado: %s role=%s por %s',
                    serializer.validated_data.get('email'), role, self.request.user.email)

    def perform_update(self, serializer):
        role = serializer.validated_data.get('role')
        if role == 'superadmin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('No se puede asignar rol superadmin vía API.')
        serializer.save()
        logger.info('[SUPERADMIN] Usuario actualizado: %s por %s', serializer.instance.email, self.request.user.email)

    def perform_destroy(self, instance):
        if instance.role == 'superadmin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('No se puede eliminar un superadmin vía API.')
        logger.warning('[SUPERADMIN] Usuario eliminado: %s por %s', instance.email, self.request.user.email)
        instance.delete()

    @action(detail=True, methods=['patch'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        if user.role == 'superadmin':
            return Response({'detail': 'No se puede desactivar un superadmin.'}, status=403)
        user.is_active = not user.is_active
        user.save(update_fields=['is_active'])
        logger.info('[SUPERADMIN] Usuario %s activo=%s por %s', user.email, user.is_active, request.user.email)
        return Response({'is_active': user.is_active})

    @action(detail=True, methods=['patch'], url_path='set-role')
    def set_role(self, request, pk=None):
        user     = self.get_object()
        new_role = request.data.get('role')
        if new_role not in self.ASSIGNABLE_ROLES:
            return Response({'detail': f'Rol inválido. Permitidos: {self.ASSIGNABLE_ROLES}'}, status=400)
        if user.role == 'superadmin':
            return Response({'detail': 'No se puede cambiar el rol de un superadmin.'}, status=403)
        old_role = user.role
        user.role = new_role
        user.save(update_fields=['role'])
        logger.info('[SUPERADMIN] Cambio de rol: %s %s→%s por %s', user.email, old_role, new_role, request.user.email)
        return Response({'role': user.role})

    @action(detail=True, methods=['patch'], url_path='set-punto')
    def set_punto(self, request, pk=None):
        """Asigna/reasigna el punto de un vendedor o administrador."""
        user = self.get_object()
        if user.role not in ('vendedor', 'administrador'):
            return Response({'detail': 'Solo aplica a Vendedor o Administrador.'}, status=400)
        try:
            punto = Punto.objects.get(id=request.data.get('punto_id'))
        except Punto.DoesNotExist:
            return Response({'detail': 'Punto no encontrado.'}, status=404)
        user.punto = punto
        user.save(update_fields=['punto'])
        logger.info('[SUPERADMIN] %s asignado a punto %s por %s', user.email, punto.slug, request.user.email)
        return Response({'punto': punto.slug})


class GlobalConfigView(APIView):
    permission_classes = SUPERADMIN_PERMS

    def get(self, request):
        return Response(GlobalConfigSerializer(GlobalConfig.get()).data)

    def patch(self, request):
        cfg = GlobalConfig.get()
        s = GlobalConfigSerializer(cfg, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        logger.info('[SUPERADMIN] Config actualizada por %s', request.user.email)
        return Response(s.data)


class AuditLogListView(APIView):
    permission_classes = SUPERADMIN_PERMS

    def get(self, request):
        page     = max(1, int(request.query_params.get('page', 1)))
        per_page = 100
        qs = AuditLog.objects.select_related('user').all()
        total = qs.count()
        items = qs[(page - 1) * per_page: page * per_page]
        return Response({'count': total, 'results': AuditLogSerializer(items, many=True).data})


class TNSSyncStatusView(APIView):
    permission_classes = SUPERADMIN_PERMS

    def get(self, request):
        logs = TNSSyncLog.objects.select_related('punto').all()[:20]
        last = logs.first()
        return Response({
            'last_sync':        TNSSyncLogSerializer(last).data if last else None,
            'history':          TNSSyncLogSerializer(logs, many=True).data,
            'pending_products': Product.objects.filter(tns_sync_status='pending').count(),
            'error_products':   Product.objects.filter(tns_sync_status='error').count(),
        })


class SuperAdminDashboardView(APIView):
    """
    Panel del SuperAdmin: ve y hace de todo, con desglose por punto —
    igual que el de Supervisor pero con capacidad de acción.
    """
    permission_classes = SUPERADMIN_PERMS

    def get(self, request):
        from apps.orders.models import Order, RepairTicket
        users_by_role = dict(User.objects.values_list('role').annotate(c=Count('id')).values_list('role', 'c'))

        productos_por_punto = list(
            Product.objects.filter(is_active=True).values('punto__name')
            .annotate(total=Count('id')).order_by('-total')
        )
        ventas_por_punto = list(
            Order.objects.filter(status__in=['paid', 'confirmed', 'shipped', 'delivered'])
            .values('punto__name').annotate(total=Count('id')).order_by('-total')
        )

        return Response({
            'users_total':            User.objects.count(),
            'users_by_role':          users_by_role,
            'productos_total':        Product.objects.filter(is_active=True).count(),
            'productos_por_punto':    productos_por_punto,
            'productos_stock_bajo':   Product.objects.filter(stock__lte=3, stock__gt=0, is_active=True).count(),
            'productos_sin_stock':    Product.objects.filter(stock=0, is_active=True).count(),
            'ventas_por_punto':       ventas_por_punto,
            'ordenes_pendientes_tns': Order.objects.filter(status='paid', tns_confirmed=False).count(),
            'reparaciones_activas':   RepairTicket.objects.exclude(status__in=['delivered', 'cancelled']).count(),
        })
