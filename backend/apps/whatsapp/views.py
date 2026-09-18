"""
apps/whatsapp/views.py
- WhatsAppWebhookView: responde 200 en milisegundos y delega el procesamiento
  real a Celery — la propia documentación de 360dialog exige esto ("Only use
  asynchronous handling of webhooks"; <5s o Meta reintenta hasta 7 días).
- WhatsAppConfigView: el Administrador/SuperAdmin activa el módulo con
  credenciales reales — hasta que eso pase, queda pausado (is_active=False).
"""
import base64
import logging

from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdministrador
from .models import WhatsAppConfig
from .serializers import WhatsAppConfigSerializer

logger = logging.getLogger('katalog.whatsapp')


class WhatsAppWebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        config = WhatsAppConfig.get()

        # Protección opcional con Basic Auth, si el admin la configuró.
        if config.webhook_basic_auth_user:
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            expected = 'Basic ' + base64.b64encode(
                f'{config.webhook_basic_auth_user}:{config.webhook_basic_auth_pass}'.encode()
            ).decode()
            if auth_header != expected:
                logger.warning('[WHATSAPP] Webhook con autenticación inválida — rechazado.')
                return Response(status=401)

        if not config.is_active:
            # Módulo pausado: confirmamos recepción (evita reintentos de Meta)
            # pero no procesamos ni respondemos nada.
            return Response({'received': True, 'processed': False}, status=200)

        # ACK inmediato — el procesamiento real ocurre en Celery, nunca aquí.
        from .tasks import process_whatsapp_webhook_event
        process_whatsapp_webhook_event.delay(request.data)
        return Response({'received': True}, status=200)


class WhatsAppConfigView(APIView):
    """
    Panel de administración del módulo. GET nunca devuelve la api_key en
    claro (solo si está configurada o no) — PATCH es la única forma de
    cargarla, y solo Administrador/SuperAdmin puede hacerlo.
    """
    permission_classes = [IsAdministrador]

    def get(self, request):
        config = WhatsAppConfig.get()
        return Response(WhatsAppConfigSerializer(config).data)

    def patch(self, request):
        config = WhatsAppConfig.get()
        s = WhatsAppConfigSerializer(config, data=request.data, partial=True)
        s.is_valid(raise_exception=True)

        activating = request.data.get('is_active') is True and not config.is_active
        s.save()

        if activating:
            config.activated_by = request.user
            config.activated_at = timezone.now()
            config.save(update_fields=['activated_by', 'activated_at'])
            logger.info('[WHATSAPP] Módulo ACTIVADO por %s', request.user.email)
        elif request.data.get('is_active') is False:
            logger.info('[WHATSAPP] Módulo PAUSADO por %s', request.user.email)

        return Response(WhatsAppConfigSerializer(config).data)
