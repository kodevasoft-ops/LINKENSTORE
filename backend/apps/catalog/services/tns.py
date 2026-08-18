"""
apps/catalog/services/tns.py
SECURITY:
- HMAC-SHA256 signature en cada request
- Timestamp anti-replay: ventana de 5 minutos
- API key y secret desde env (nunca hardcoded)
- Timeout configurado (no hang infinito)
- Error handling graceful (nunca crashea la app)
- Solo GET (lectura) — nunca escribe en TNS automáticamente
"""
import hashlib
import hmac
import logging
import time

import requests
from django.conf import settings

logger = logging.getLogger('katalog.tns')

TNS_REPLAY_WINDOW = 300  # 5 minutos — requests más antiguos son rechazados


class TNSClient:
    def __init__(self):
        self.base_url = getattr(settings, 'TNS_API_URL', '').rstrip('/')
        self.api_key  = getattr(settings, 'TNS_API_KEY', '')
        self.secret   = getattr(settings, 'TNS_HMAC_SECRET', '')
        self.timeout  = 10  # segundos

    def _is_configured(self) -> bool:
        return bool(self.base_url and self.api_key and self.secret)

    def _sign(self, timestamp: str, method: str, path: str, body: str) -> str:
        """
        HMAC-SHA256 firma: timestamp + method + path + body
        El servidor TNS verifica que:
        1. La firma sea válida (anti-tampering)
        2. El timestamp esté dentro de ±5min (anti-replay)
        """
        payload = f"{timestamp}.{method}.{path}.{body}"
        return hmac.new(
            self.secret.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

    def _headers(self, method: str, path: str, body: str = '{}') -> dict:
        timestamp = str(int(time.time()))
        signature = self._sign(timestamp, method.upper(), path, body)
        return {
            'X-API-Key':        self.api_key,
            'X-Timestamp':      timestamp,
            'X-Signature':      signature,
            'Content-Type':     'application/json',
            'Accept':           'application/json',
        }

    def fetch_product(self, sku: str) -> dict | None:
        """
        GET stock y precio de un SKU desde TNS.
        Returns: {'stock': int, 'price': Decimal} or None
        """
        if not self._is_configured():
            logger.debug('[TNS] Not configured — skipping sync')
            return None
        if not sku or not sku.strip():
            return None

        path = f'/products/{sku.strip()}'
        try:
            response = requests.get(
                f'{self.base_url}{path}',
                headers=self._headers('GET', path),
                timeout=self.timeout,
            )
            if response.status_code == 404:
                logger.debug('[TNS] SKU not found: %s', sku)
                return None
            if response.status_code == 401:
                logger.error('[TNS] Authentication failed — check API key and secret')
                return None
            response.raise_for_status()
            data = response.json()
            stock = int(data.get('stock', 0))
            price = data.get('price')
            if price is not None:
                from decimal import Decimal
                price = Decimal(str(price))
            return {'stock': max(0, stock), 'price': price}

        except requests.Timeout:
            logger.warning('[TNS] Timeout for SKU %s after %ds', sku, self.timeout)
            return None
        except requests.ConnectionError as e:
            logger.warning('[TNS] Connection error for SKU %s: %s', sku, e)
            return None
        except requests.HTTPError as e:
            logger.error('[TNS] HTTP error for SKU %s: %s', sku, e)
            return None
        except (ValueError, KeyError) as e:
            logger.error('[TNS] Invalid response for SKU %s: %s', sku, e)
            return None
        except Exception as e:
            logger.error('[TNS] Unexpected error for SKU %s: %s', sku, e)
            return None

    def health_check(self) -> bool:
        """Verifica conectividad con TNS sin exponer datos."""
        if not self._is_configured():
            return False
        try:
            path = '/health'
            r = requests.get(
                f'{self.base_url}{path}',
                headers=self._headers('GET', path),
                timeout=5,
            )
            return r.status_code == 200
        except Exception:
            return False
