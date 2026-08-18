from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from apps.core.health_urls import urlpatterns as health_urls
from apps.core.security_urls import urlpatterns as security_urls

urlpatterns = [
    path('', include('django_prometheus.urls')),  # /metrics for Grafana/Datadog
    path('django-admin/', admin.site.urls),
    path('', include(health_urls)),
    path('api/v1/security/', include(security_urls)),
    path('api/v1/auth/', include('apps.core.auth.urls')),
    path('api/v1/areas/',    include('apps.catalog.urls.areas')),
    path('api/v1/products/', include('apps.catalog.urls.products')),
    path('api/v1/brands/',   include('apps.catalog.urls.brands')),
    path('api/v1/orders/',   include('apps.orders.urls')),
    path('api/v1/repairs/',  include('apps.technicians.urls')),
    path('api/v1/analytics/', include('apps.analytics.urls')),
    path('api/v1/superadmin/', include('apps.superadmin.urls')),
    path('api/v1/webhooks/', include('apps.orders.webhook_urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
