from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrderViewSet, ValidateCouponView
router = DefaultRouter()
router.register('', OrderViewSet, basename='order')
urlpatterns = [path('validate-coupon/', ValidateCouponView.as_view(), name='validate-coupon'), path('', include(router.urls))]
