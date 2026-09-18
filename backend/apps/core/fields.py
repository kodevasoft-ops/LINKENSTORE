"""
apps/core/fields.py
Campo de Django que cifra su valor en reposo con Fernet (AES-128 en modo CBC
+ HMAC) antes de guardarlo en la base de datos. Se usa para credenciales que
un administrador ingresa desde el panel (no desde variables de entorno) —
como la API Key de WhatsApp/360dialog — donde SÍ necesitamos poder
desencriptar para volver a usarlas, a diferencia de una contraseña (que solo
se hashea, nunca se recupera).
"""
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models


def _get_fernet() -> Fernet:
    key = getattr(settings, 'FIELD_ENCRYPTION_KEY', None)
    if not key:
        raise RuntimeError(
            'FIELD_ENCRYPTION_KEY no está configurado — genera uno con '
            '`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` '
            'y ponlo en el .env. Nunca reutilices el mismo valor entre entornos.'
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


class EncryptedCharField(models.TextField):
    """
    Cifra en `get_prep_value` (justo antes de escribir a la BD) y descifra en
    `from_db_value` (justo al leer). El valor en texto plano NUNCA toca disco.
    """
    description = 'Texto cifrado en reposo con Fernet'

    def get_prep_value(self, value):
        if value is None or value == '':
            return value
        value = str(value)
        return _get_fernet().encrypt(value.encode()).decode()

    def from_db_value(self, value, expression, connection):
        if value is None or value == '':
            return value
        try:
            return _get_fernet().decrypt(value.encode()).decode()
        except InvalidToken:
            # Clave rotada o dato corrupto — no reventamos toda la request,
            # devolvemos vacío y queda registrado que hay que re-ingresar la credencial.
            return ''
