from django.urls import path
from .views import WhatsAppWebhookView, WhatsAppConfigView

urlpatterns = [
    path('webhook/', WhatsAppWebhookView.as_view(), name='whatsapp-webhook'),
    path('config/',  WhatsAppConfigView.as_view(),  name='whatsapp-config'),
]
