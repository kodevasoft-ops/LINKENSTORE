from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CheckoutSessionViewSet, OrderViewSet, EnvioViewSet, TrackShipmentView,
    ValidateCouponView, CouponViewSet,
)

router = DefaultRouter()
router.register('checkout-sessions', CheckoutSessionViewSet, basename='checkout-session')
router.register('envios', EnvioViewSet, basename='envio')
router.register('coupons', CouponViewSet, basename='coupon')
router.register('', OrderViewSet, basename='order')

urlpatterns = [
    path('rastrear-envio/', TrackShipmentView.as_view(), name='track-shipment'),
    path('validate-coupon/', ValidateCouponView.as_view(), name='validate-coupon'),
    path('', include(router.urls)),
]
