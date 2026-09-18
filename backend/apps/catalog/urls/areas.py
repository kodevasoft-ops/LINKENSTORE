from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.catalog.views import AreaViewSet
router = DefaultRouter()
router.register('', AreaViewSet, basename='area')
urlpatterns = [path('', include(router.urls))]
