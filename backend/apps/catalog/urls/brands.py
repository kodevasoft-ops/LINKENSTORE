from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.catalog.views import BrandViewSet
router = DefaultRouter()
router.register('', BrandViewSet, basename='brand')
urlpatterns = [path('', include(router.urls))]
