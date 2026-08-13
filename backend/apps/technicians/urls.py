from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RepairTicketViewSet
router = DefaultRouter()
router.register('', RepairTicketViewSet, basename='repair-ticket')
urlpatterns = [path('', include(router.urls))]
