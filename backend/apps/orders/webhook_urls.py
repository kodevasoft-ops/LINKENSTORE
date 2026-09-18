from django.urls import path
from .views import WompiWebhookView
urlpatterns = [path('wompi/', WompiWebhookView.as_view(), name='wompi-webhook')]
