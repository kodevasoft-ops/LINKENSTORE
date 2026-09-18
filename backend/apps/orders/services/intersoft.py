"""
apps/orders/services/intersoft.py
Cliente de solo lectura para la InterSoft API (rastreo de guías Interrápidísimo).
SECURITY:
- Doble autenticación: Authorization Bearer (API_KEY) + header X-API-Secret (SECRET_KEY).
- Ambas credenciales SOLO se usan desde este servicio de backend — nunca se
  exponen al frontend (la doc de InterSoft lo advierte explícitamente).
- Timeout configurado, manejo de errores sin crashear la app.
- Respeta la cuota diaria: si la API responde 429, se registra y se corta,
  nunca se reintenta en loop.
"""
import logging

import requests
from django.conf import settings

logger = logging.getLogger('katalog.intersoft')


class InterSoftClient:
    def __init__(self):
        self.base_url   = getattr(settings, 'INTERSOFT_BASE_URL', '').rstrip('/')
        self.api_key    = getattr(settings, 'INTERSOFT_API_KEY', '')
        self.secret_key = getattr(settings, 'INTERSOFT_SECRET_KEY', '')
        self.timeout    = 10

    def is_configured(self) -> bool:
        return bool(self.base_url and self.api_key and self.secret_key)

    def _headers(self) -> dict:
        return {
            'Authorization': f'Bearer {self.api_key}',
            'X-API-Secret':  self.secret_key,
            'Accept':        'application/json',
        }

    def health_check(self) -> bool:
        if not self.base_url:
            return False
        try:
            r = requests.get(f'{self.base_url}/api/ext/estado', timeout=5)
            return r.status_code == 200 and r.json().get('ok') is True
        except Exception:
            return False

    def consultar_guia(self, guide_number: str) -> dict:
        """
        Consulta el estado de una guía. Retorna un dict normalizado:
        {'encontrado': bool, 'datos': dict|None, 'error': str|None, 'cuota': dict|None}
        Nunca lanza excepción — cualquier falla se resume en 'error'.
        """
        if not self.is_configured():
            return {'encontrado': False, 'datos': None, 'error': 'InterSoft no está configurado.', 'cuota': None}

        guide = (guide_number or '').strip().upper()
        if not guide:
            return {'encontrado': False, 'datos': None, 'error': 'Número de guía requerido.', 'cuota': None}

        try:
            r = requests.get(
                f'{self.base_url}/api/ext/consultar/{guide}',
                headers=self._headers(),
                timeout=self.timeout,
            )
        except requests.Timeout:
            logger.warning('[INTERSOFT] Timeout consultando guía %s', guide)
            return {'encontrado': False, 'datos': None, 'error': 'El servicio de rastreo no respondió a tiempo.', 'cuota': None}
        except requests.ConnectionError as e:
            logger.warning('[INTERSOFT] Error de conexión: %s', e)
            return {'encontrado': False, 'datos': None, 'error': 'No se pudo conectar con el servicio de rastreo.', 'cuota': None}

        if r.status_code == 401 or r.status_code == 403:
            logger.error('[INTERSOFT] Credenciales inválidas o IP no autorizada (status=%s)', r.status_code)
            return {'encontrado': False, 'datos': None, 'error': 'Error de autenticación con el servicio de rastreo.', 'cuota': None}

        if r.status_code == 429:
            logger.warning('[INTERSOFT] Cuota diaria agotada')
            return {'encontrado': False, 'datos': None, 'error': 'Cuota diaria de consultas agotada.', 'cuota': None}

        if r.status_code >= 500:
            logger.error('[INTERSOFT] Error del servidor: %s', r.status_code)
            return {'encontrado': False, 'datos': None, 'error': 'Servicio de rastreo temporalmente no disponible.', 'cuota': None}

        try:
            body = r.json()
        except ValueError:
            return {'encontrado': False, 'datos': None, 'error': 'Respuesta inválida del servicio de rastreo.', 'cuota': None}

        return {
            'encontrado': body.get('encontrado', False),
            'datos':      body.get('datos'),
            'error':      body.get('mensaje') if not body.get('encontrado') else None,
            'cuota':      body.get('cuota'),
            'raw':        body,
        }
