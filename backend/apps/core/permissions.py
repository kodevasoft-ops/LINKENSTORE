from rest_framework.permissions import BasePermission
class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'superadmin')
class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in ('admin', 'superadmin'))
class IsAdvisorOrAbove(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in ('advisor', 'admin', 'superadmin'))
class IsTechnicianOrAbove(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in ('technician', 'admin', 'superadmin'))
class IsOwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.role in ('admin', 'superadmin'): return True
        owner = getattr(obj, 'customer_id', None) or getattr(obj, 'user_id', None)
        return str(owner) == str(request.user.id)
