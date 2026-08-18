"""
apps/core/auth/mfa.py
TOTP (Time-based One-Time Password) para roles admin y superadmin.
Usa pyotp — compatible con Google Authenticator, Authy, 1Password.
"""
import pyotp
import logging
from django.conf import settings
from django.core.cache import cache
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger('katalog.mfa')

MFA_REQUIRED_ROLES = getattr(settings, 'MFA_REQUIRED_ROLES', ['admin', 'superadmin'])
MFA_TOTP_ISSUER    = getattr(settings, 'MFA_TOTP_ISSUER', 'Katalog Enterprise')


def get_mfa_secret(user) -> str:
    """Get or create TOTP secret for user — stored in cache with long TTL."""
    cache_key = f'mfa_secret:{user.id}'
    secret = cache.get(cache_key)
    if not secret:
        # In production, store in encrypted DB field
        secret = user.mfa_secret if hasattr(user, 'mfa_secret') and user.mfa_secret else pyotp.random_base32()
        cache.set(cache_key, secret, 86400 * 365)
    return secret


def verify_totp(user, token: str) -> bool:
    """Verify TOTP token with ±30s window."""
    secret = get_mfa_secret(user)
    totp = pyotp.TOTP(secret, issuer=MFA_TOTP_ISSUER)
    return totp.verify(token, valid_window=1)


class MFASetupView(APIView):
    """Returns QR code URI for authenticator app setup."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in MFA_REQUIRED_ROLES:
            return Response({'detail': 'MFA no requerido para tu rol.'}, status=400)
        secret = get_mfa_secret(request.user)
        totp   = pyotp.TOTP(secret, issuer=MFA_TOTP_ISSUER)
        uri    = totp.provisioning_uri(name=request.user.email, issuer_name=MFA_TOTP_ISSUER)
        return Response({'uri': uri, 'secret': secret})


class MFAVerifyView(APIView):
    """Verifies TOTP token and stores session flag for 8h."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get('token', '').strip()
        if not token:
            return Response({'detail': 'Token requerido.'}, status=400)
        if verify_totp(request.user, token):
            cache.set(f'mfa_verified:{request.user.id}', True, 28800)  # 8 hours
            logger.info('[MFA] Verified for user=%s', request.user.email)
            return Response({'verified': True})
        logger.warning('[MFA] Failed verification for user=%s', request.user.email)
        return Response({'detail': 'Token inválido o expirado.'}, status=401)


class MFARequiredPermission(IsAuthenticated):
    """Permission that enforces MFA for admin/superadmin roles."""
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        user = request.user
        if user.role not in MFA_REQUIRED_ROLES:
            return True
        # Check if MFA was verified in this session
        if not cache.get(f'mfa_verified:{user.id}'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('MFA requerido. Verifica tu código TOTP en /api/v1/auth/mfa/verify/')
        return True
