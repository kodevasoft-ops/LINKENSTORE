from rest_framework.permissions import BasePermission


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'superadmin')


class IsSupervisorOrAbove(BasePermission):
    """Supervisor: ve y consulta todo, no puede crear/editar nada operativo — solo lectura global."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and
                    request.user.role in ('supervisor', 'superadmin'))


class IsAdministrador(BasePermission):
    """Administrador de un punto — manda sobre su propio punto únicamente."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and
                    request.user.role in ('administrador', 'superadmin'))


class IsVendedorOrAbove(BasePermission):
    """Para ACCIONES DE ESCRITURA: crear/confirmar ventas, registrar envíos. Supervisor NO incluido — es de solo consulta."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and
                    request.user.role in ('vendedor', 'administrador', 'superadmin'))


class CanViewSalesReports(BasePermission):
    """Para LECTURA de reportes/feeds de ventas — sí incluye Supervisor, que consulta todo pero no opera."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and
                    request.user.role in ('vendedor', 'administrador', 'supervisor', 'superadmin'))


class IsTecnicoOrAbove(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and
                    request.user.role in ('tecnico', 'administrador_tecnico', 'superadmin'))


class IsAdministradorTecnico(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and
                    request.user.role in ('administrador_tecnico', 'superadmin'))


class ReadOnlyForTecnico(BasePermission):
    """
    El técnico ve todo lo que se hace en su área, pero NUNCA puede crear/editar/borrar
    nada fuera de sus propios tickets de reparación asignados.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role != 'tecnico':
            return True
        return request.method in ('GET', 'HEAD', 'OPTIONS')


class IsOwnerOrStaff(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.role in ('administrador', 'superadmin', 'supervisor'):
            return True
        owner = getattr(obj, 'customer_id', None) or getattr(obj, 'user_id', None)
        return str(owner) == str(request.user.id)


def scoped_to_own_punto(user) -> bool:
    """True si este usuario solo debe ver/operar sobre SU punto (no todos)."""
    return user.role in ('vendedor', 'administrador')


class SamePuntoOnly(BasePermission):
    """
    Bloquea el acceso a objetos (productos, órdenes) de un punto distinto al
    del usuario, para roles vendedor/administrador. superadmin y supervisor
    no tienen esta restricción.
    """
    def has_object_permission(self, request, view, obj):
        if not scoped_to_own_punto(request.user):
            return True
        obj_punto_id = getattr(obj, 'punto_id', None)
        return obj_punto_id is not None and str(obj_punto_id) == str(request.user.punto_id)
