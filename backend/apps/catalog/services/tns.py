"""
apps/catalog/services/tns.py

REESCRITO tras comparar contra la documentación real del API (api.tns.co) que
compartió el cliente. Dos correcciones de fondo respecto a la versión anterior:

1. AUTENTICACIÓN: el API real expone `POST /v2/Acceso/Login` como primer
   endpoint listado — es un login que casi con certeza devuelve un token de
   sesión, NO el esquema de firma HMAC por-request que tenía el código
   anterior (que probablemente fue una suposición nunca verificada contra
   la documentación real). Aquí se implementa login + cacheo del token en
   Redis con expiración, renovando automáticamente cuando vence.

2. ENDPOINTS REALES, no inventados: el endpoint `/products/{sku}` que usaba
   la versión anterior NO EXISTE en la documentación compartida. El listado
   real de artículos es `GET /v2/tablas/Material/Listar`.

⚠️ ADVERTENCIA EXPLÍCITA — lo que SÍ y lo que NO está confirmado:
Los NOMBRES de los endpoints están confirmados contra tu documentación.
Los NOMBRES DE CAMPOS de request/response (usuario, contraseña, nombre del
token, forma exacta del payload de Tercero, etc.) son la mejor suposición
razonable basada en convenciones típicas de ERPs colombianos — están
marcados con comentarios "# CONFIRMAR" en cada sitio relevante. Si algo
falla en producción, lo primero a revisar es exactamente ese campo.

SEGURIDAD:
- Solo POST para creación — nunca DELETE ni PUT/PATCH destructivo, tal como
  exige la regla de negocio ("no puede borrar nada, solo crear").
- Token de sesión cacheado, nunca logueado en texto plano.
- Timeout configurado en cada request — nunca puede colgar la app.
"""
import logging
import time

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger('katalog.tns')

TNS_TOKEN_CACHE_KEY = 'tns_session_token'
TNS_TOKEN_SAFETY_MARGIN = 60  # renovar 60s antes de que venza, no justo al filo


class TNSClient:
    def __init__(self):
        self.base_url = getattr(settings, 'TNS_API_URL', '').rstrip('/')
        self.api_key  = getattr(settings, 'TNS_API_KEY', '')       # usuario o api_key del login — CONFIRMAR nombre exacto del campo
        self.secret   = getattr(settings, 'TNS_HMAC_SECRET', '')   # contraseña o secret del login — CONFIRMAR
        self.timeout  = 10

    def _is_configured(self) -> bool:
        return bool(self.base_url and self.api_key and self.secret)

    # ── Autenticación ──────────────────────────────────────────────────
    def _login(self) -> str | None:
        """
        POST /v2/Acceso/Login — obtiene un token de sesión y lo cachea.
        CONFIRMAR: nombres exactos de los campos del body y de la respuesta.
        Aquí se asume la convención más común (usuario/clave → token +
        expiración en segundos), pero es una suposición razonada, no un hecho verificado.
        """
        if not self._is_configured():
            return None
        try:
            response = requests.post(
                f'{self.base_url}/v2/Acceso/Login',
                json={'usuario': self.api_key, 'clave': self.secret},  # CONFIRMAR nombres de campos
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()
            token = data.get('token') or data.get('access_token')  # CONFIRMAR cuál de los dos (o algo distinto)
            expires_in = int(data.get('expira_en', data.get('expires_in', 3600)))  # CONFIRMAR
            if not token:
                logger.error('[TNS] Login exitoso pero la respuesta no trae un campo de token reconocible.')
                return None
            cache.set(TNS_TOKEN_CACHE_KEY, token, max(expires_in - TNS_TOKEN_SAFETY_MARGIN, 30))
            logger.info('[TNS] Login exitoso — token renovado.')
            return token
        except requests.RequestException as e:
            logger.error('[TNS] Falló el login: %s', e)
            return None

    def _get_token(self) -> str | None:
        token = cache.get(TNS_TOKEN_CACHE_KEY)
        return token or self._login()

    def _headers(self) -> dict | None:
        token = self._get_token()
        if not token:
            return None
        return {
            'Authorization': f'Bearer {token}',  # CONFIRMAR: podría ser un header custom en vez de Bearer
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }

    def _request(self, method: str, path: str, **kwargs) -> requests.Response | None:
        headers = self._headers()
        if headers is None:
            logger.warning('[TNS] Sin token válido — request a %s cancelado.', path)
            return None
        try:
            response = requests.request(method, f'{self.base_url}{path}', headers=headers, timeout=self.timeout, **kwargs)
            if response.status_code == 401:
                # Token vencido pese al cacheo (reloj desfasado, revocación manual, etc.)
                # — un solo reintento con login forzado, nunca un loop infinito.
                cache.delete(TNS_TOKEN_CACHE_KEY)
                headers = self._headers()
                if headers is None:
                    return None
                response = requests.request(method, f'{self.base_url}{path}', headers=headers, timeout=self.timeout, **kwargs)
            return response
        except requests.Timeout:
            logger.warning('[TNS] Timeout en %s %s', method, path)
            return None
        except requests.ConnectionError as e:
            logger.warning('[TNS] Error de conexión en %s %s: %s', method, path, e)
            return None

    # ── Inventario (solo lectura) ────────────────────────────────────────
    def fetch_product(self, sku: str) -> dict | None:
        """
        GET /v2/tablas/Material/Listar — CORREGIDO: el endpoint anterior
        (/products/{sku}) no existe en la documentación real.
        CONFIRMAR: nombre exacto del query param para filtrar por SKU/código
        (aquí se asume 'codigo', convención común en ERPs colombianos) y
        la forma exacta de la respuesta (aquí se asume una lista con 'stock'/'precio').
        """
        if not sku or not sku.strip():
            return None
        response = self._request('GET', '/v2/tablas/Material/Listar', params={'codigo': sku.strip()})  # CONFIRMAR param
        if response is None or response.status_code != 200:
            return None
        try:
            data = response.json()
            items = data if isinstance(data, list) else data.get('items', data.get('resultado', []))
            if not items:
                return None
            item = items[0]
            stock = int(item.get('stock', item.get('existencia', 0)))  # CONFIRMAR nombre del campo
            price = item.get('precio', item.get('precioVenta'))         # CONFIRMAR nombre del campo
            from decimal import Decimal
            return {'stock': max(0, stock), 'price': Decimal(str(price)) if price is not None else None}
        except (ValueError, KeyError, IndexError, TypeError) as e:
            logger.error('[TNS] Respuesta inesperada de Material/Listar para %s: %s', sku, e)
            return None

    def health_check(self) -> bool:
        response = self._request('GET', '/v2/tablas/Ciudades/GetAllCiudades')
        return response is not None and response.status_code == 200

    # ── Ciudades / Barrios (necesarios para crear un Tercero) ────────────
    def listar_ciudades(self) -> list[dict]:
        """GET /v2/tablas/Ciudades/GetAllCiudades — se cachea 24h, cambia poco."""
        cached = cache.get('tns_ciudades')
        if cached is not None:
            return cached
        response = self._request('GET', '/v2/tablas/Ciudades/GetAllCiudades')
        if response is None or response.status_code != 200:
            return []
        ciudades = response.json()
        cache.set('tns_ciudades', ciudades, 86400)
        return ciudades

    def crear_barrio(self, nombre: str, ciudad_id: str) -> dict | None:
        """POST /v2/tablas/Barrios/Insertar — CONFIRMAR forma exacta del payload."""
        response = self._request('POST', '/v2/tablas/Barrios/Insertar', json={
            'nombre': nombre, 'ciudadId': ciudad_id,  # CONFIRMAR nombres de campos
        })
        if response is None or response.status_code not in (200, 201):
            logger.warning('[TNS] No se pudo crear barrio "%s": %s', nombre, response.text[:200] if response else 'sin respuesta')
            return None
        return response.json()

    # ── Terceros (clientes) — la creación explícitamente autorizada ──────
    def crear_tercero(self, *, nombre: str, tipo_documento: str, numero_documento: str,
                       telefono: str = '', email: str = '', direccion: str = '',
                       ciudad_id: str = '') -> dict | None:
        """
        POST /v2/tablas/Tercero/Crear — SOLO CREA, nunca actualiza ni borra.
        Se usa para que el cliente que compró por la web ya exista en TNS
        cuando el vendedor vaya a facturar manualmente — así no lo digita dos veces.
        CONFIRMAR: nombres exactos de cada campo del payload esperado por TNS.
        """
        if not self._is_configured():
            return None
        payload = {  # CONFIRMAR cada nombre de campo contra la documentación real
            'nombre': nombre,
            'tipoDocumento': tipo_documento,
            'numeroDocumento': numero_documento,
            'telefono': telefono,
            'email': email,
            'direccion': direccion,
            'ciudadId': ciudad_id,
        }
        response = self._request('POST', '/v2/tablas/Tercero/Crear', json=payload)
        if response is None:
            return None
        if response.status_code not in (200, 201):
            logger.warning('[TNS] No se pudo crear tercero "%s": %s', numero_documento, response.text[:300])
            return None
        logger.info('[TNS] Tercero creado: %s (%s)', nombre, numero_documento)
        return response.json()

    def buscar_tercero(self, numero_documento: str) -> dict | None:
        """GET /v2/tablas/Tercero/Listar — para evitar crear un tercero duplicado."""
        response = self._request('GET', '/v2/tablas/Tercero/Listar', params={'documento': numero_documento})  # CONFIRMAR param
        if response is None or response.status_code != 200:
            return None
        try:
            data = response.json()
            items = data if isinstance(data, list) else data.get('items', [])
            return items[0] if items else None
        except (ValueError, IndexError):
            return None
