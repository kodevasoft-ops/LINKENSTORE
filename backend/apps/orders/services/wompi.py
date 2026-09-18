"""
apps/orders/services/wompi.py
SECURITY:
- La firma de integridad (integrity signature) se calcula SIEMPRE en el backend,
  nunca en el navegador — evita que alguien manipule el monto desde el cliente.
- La firma del webhook (checksum) se verifica antes de procesar cualquier evento.
- Llaves desde env, nunca hardcodeadas.
"""
import hashlib
import logging
from functools import reduce

from django.conf import settings

logger = logging.getLogger('katalog.wompi')


class WompiClient:
    def __init__(self):
        self.public_key      = getattr(settings, 'WOMPI_PUBLIC_KEY', '')
        self.private_key     = getattr(settings, 'WOMPI_PRIVATE_KEY', '')
        self.integrity_secret = getattr(settings, 'WOMPI_INTEGRITY_SECRET', '')
        self.events_secret    = getattr(settings, 'WOMPI_EVENTS_SECRET', '')
        self.api_url          = getattr(settings, 'WOMPI_API_URL', 'https://production.wompi.co/v1')

    def is_configured(self) -> bool:
        return bool(self.public_key and self.integrity_secret)

    def build_checkout_signature(self, reference: str, amount_in_cents: int, currency: str = 'COP') -> str:
        """
        Firma de integridad requerida por el Web Checkout de Wompi.
        Formula oficial: SHA256(referencia + monto_en_centavos + moneda + secreto_integridad)
        """
        raw = f'{reference}{amount_in_cents}{currency}{self.integrity_secret}'
        return hashlib.sha256(raw.encode('utf-8')).hexdigest()

    def get_checkout_params(self, reference: str, amount_in_cents: int, redirect_url: str, currency: str = 'COP') -> dict:
        """Parámetros listos para construir la URL del Web Checkout hospedado por Wompi."""
        if not self.is_configured():
            raise RuntimeError('Wompi no está configurado — revisa WOMPI_PUBLIC_KEY y WOMPI_INTEGRITY_SECRET.')
        return {
            'public_key':          self.public_key,
            'currency':            currency,
            'amount_in_cents':     amount_in_cents,
            'reference':           reference,
            'signature_integrity': self.build_checkout_signature(reference, amount_in_cents, currency),
            'redirect_url':        redirect_url,
        }

    @staticmethod
    def _get_nested(data: dict, dotted_path: str):
        return reduce(lambda d, k: d.get(k, {}) if isinstance(d, dict) else None, dotted_path.split('.'), data)

    def verify_webhook_signature(self, payload: dict) -> bool:
        """
        Verifica el checksum del evento de Wompi antes de confiar en su contenido.
        Formula: SHA256(valores_concatenados_de_properties + timestamp + events_secret)
        """
        if not self.events_secret:
            logger.error('[WOMPI] WOMPI_EVENTS_SECRET no configurado — rechazando webhook.')
            return False
        try:
            sig_block  = payload['signature']
            properties = sig_block['properties']
            checksum   = sig_block['checksum']
            timestamp  = payload['timestamp']

            concat = ''.join(str(self._get_nested(payload['data'], prop)) for prop in properties)
            raw = f'{concat}{timestamp}{self.events_secret}'
            expected = hashlib.sha256(raw.encode('utf-8')).hexdigest()
            return hashlib.compare_digest(expected, checksum)
        except (KeyError, TypeError) as e:
            logger.warning('[WOMPI] Webhook con formato inesperado: %s', e)
            return False
