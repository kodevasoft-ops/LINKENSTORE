"""
apps/whatsapp/services/dialog360.py
Cliente para la Messaging API de 360dialog (https://waba-v2.360dialog.io).
Verificado contra la documentación oficial real:
- Autenticación: header 'D360-API-KEY'
- Envío: POST /messages
- Nunca envía nada si el módulo no está activo (WhatsAppConfig.is_usable())
"""
import logging

import requests
from django.conf import settings

logger = logging.getLogger('katalog.whatsapp')

PRODUCTION_BASE_URL = 'https://waba-v2.360dialog.io'
SANDBOX_BASE_URL    = 'https://waba-sandbox.360dialog.io/v1'


class Dialog360Client:
    def __init__(self, api_key: str, sandbox: bool = False):
        self.api_key  = api_key
        self.base_url = SANDBOX_BASE_URL if sandbox else PRODUCTION_BASE_URL
        self.timeout  = 10

    def _headers(self) -> dict:
        return {'D360-API-KEY': self.api_key, 'Content-Type': 'application/json'}

    def send_text(self, to: str, body: str) -> dict:
        """
        Mensaje de texto libre — SOLO válido dentro de la ventana de 24h
        abierta por el cliente (gratis). Fuera de esa ventana, WhatsApp
        rechaza el envío y hay que usar send_template en su lugar.
        """
        payload = {
            'messaging_product': 'whatsapp',
            'recipient_type': 'individual',
            'to': to,
            'type': 'text',
            'text': {'body': body},
        }
        return self._post('/messages', payload)

    def send_template(self, to: str, template_name: str, language_code: str, body_params: list[str] | None = None) -> dict:
        """
        Mensaje con plantilla aprobada por Meta — el único tipo de mensaje
        que se puede enviar SIN que el cliente haya escrito primero
        (recordatorio de carrito, confirmación de venta espontánea).
        Esto puede tener costo — ver DEPLOY.md, sección WhatsApp.
        """
        components = []
        if body_params:
            components.append({
                'type': 'body',
                'parameters': [{'type': 'text', 'text': p} for p in body_params],
            })
        payload = {
            'to': to,
            'messaging_product': 'whatsapp',
            'type': 'template',
            'template': {
                'name': template_name,
                'language': {'code': language_code},
                'components': components,
            },
        }
        return self._post('/messages', payload)

    def mark_as_read(self, wa_message_id: str) -> dict:
        payload = {'messaging_product': 'whatsapp', 'status': 'read', 'message_id': wa_message_id}
        return self._post('/messages', payload)

    def _post(self, path: str, payload: dict) -> dict:
        try:
            r = requests.post(f'{self.base_url}{path}', json=payload, headers=self._headers(), timeout=self.timeout)
        except requests.RequestException as e:
            logger.error('[WHATSAPP] Error de red enviando a %s: %s', payload.get('to'), e)
            return {'ok': False, 'error': str(e)}

        if r.status_code >= 400:
            logger.warning('[WHATSAPP] Error %s enviando mensaje: %s', r.status_code, r.text[:300])
            return {'ok': False, 'status_code': r.status_code, 'error': r.text}

        return {'ok': True, 'data': r.json()}


def get_client_or_none() -> Dialog360Client | None:
    """
    Punto único de entrada — respeta el 'pausado por defecto': si el
    administrador no ha activado el módulo con credenciales reales,
    esto devuelve None y NINGÚN mensaje se envía, sin excepciones ruidosas.
    """
    from apps.whatsapp.models import WhatsAppConfig
    config = WhatsAppConfig.get()
    if not config.is_usable():
        return None
    return Dialog360Client(api_key=config.api_key)
