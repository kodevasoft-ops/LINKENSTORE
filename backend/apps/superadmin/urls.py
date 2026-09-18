from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AdminUserViewSet, GlobalConfigView, AuditLogListView, TNSSyncStatusView, SuperAdminDashboardView
router = DefaultRouter()
router.register('users', AdminUserViewSet, basename='admin-user')
urlpatterns = [path('config/', GlobalConfigView.as_view()), path('audit-logs/', AuditLogListView.as_view()), path('tns-sync/', TNSSyncStatusView.as_view()), path('dashboard/', SuperAdminDashboardView.as_view()), path('', include(router.urls))]
