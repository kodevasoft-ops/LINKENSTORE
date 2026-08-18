import hashlib, logging, time
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from apps.core.throttling import LoginRateThrottle
from .serializers import LoginSerializer, RegisterSerializer, UserMeSerializer, ChangePasswordSerializer

logger = logging.getLogger('katalog.auth')
User   = get_user_model()
LOGIN_MIN     = 0.5
MAX_ATTEMPTS  = 5
LOCKOUT_SECS  = 900  # 15 min — from settings.LOGIN_LOCKOUT_SECS
LOCKOUT_KEY = lambda e: f'login_lockout:{hashlib.sha256(e.encode()).hexdigest()}'
ATTEMPTS_KEY = lambda e: f'login_attempts:{hashlib.sha256(e.encode()).hexdigest()}'

class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes   = [LoginRateThrottle]
    def post(self, request):
        t = time.monotonic()
        email = request.data.get('email', '').lower().strip()
        if cache.get(LOCKOUT_KEY(email)):
            self._pad(t)
            return Response({'detail': 'Cuenta bloqueada. Intenta en 15 minutos.'}, status=429)
        s = LoginSerializer(data=request.data)
        if not s.is_valid():
            self._pad(t); return Response(s.errors, status=400)
        user = s.validated_data.get('user')
        if not user:
            att = cache.get(ATTEMPTS_KEY(email), 0) + 1
            cache.set(ATTEMPTS_KEY(email), att, LOCKOUT_SECS)
            if att >= MAX_ATTEMPTS: cache.set(LOCKOUT_KEY(email), True, LOCKOUT_SECS)
            self._pad(t); return Response({'detail': 'Credenciales inválidas.'}, status=401)
        cache.delete(ATTEMPTS_KEY(email)); cache.delete(LOCKOUT_KEY(email))
        ref = RefreshToken.for_user(user)
        ref['role'] = user.role; ref['email'] = user.email
        self._pad(t)
        return Response({'access': str(ref.access_token), 'refresh': str(ref), 'user': {'id': str(user.id), 'email': user.email, 'first_name': user.first_name, 'last_name': user.last_name, 'role': user.role}})
    @staticmethod
    def _pad(t):
        e = time.monotonic() - t
        if e < LOGIN_MIN: time.sleep(LOGIN_MIN - e)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            rf = request.data.get('refresh')
            if rf: RefreshToken(rf).blacklist()
        except TokenError: pass
        if request.auth and hasattr(request.auth, 'get'):
            jti = request.auth.get('jti')
            if jti: cache.set(f'jwt_blacklist:{jti}', True, 86400)
        return Response({'detail': 'Sesión cerrada.'})

class RegisterView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        s = RegisterSerializer(data=request.data)
        if not s.is_valid(): return Response(s.errors, status=400)
        user = s.save()
        try:
            from apps.analytics.models import CustomerRegistration
            from apps.analytics.signals import _get_source
            import hashlib as hl
            utm_source   = request.data.get('utm_source', '')
            utm_medium   = request.data.get('utm_medium', '')
            utm_campaign = request.data.get('utm_campaign', '')
            referrer     = request.data.get('referrer', '')
            ip           = request.META.get('HTTP_X_REAL_IP', request.META.get('REMOTE_ADDR', ''))
            CustomerRegistration.objects.get_or_create(user=user, defaults={'source': _get_source(utm_source, referrer), 'referrer': referrer[:500], 'utm_source': utm_source[:100], 'utm_medium': utm_medium[:100], 'utm_campaign': utm_campaign[:100], 'ip_hash': hl.sha256(ip.encode()).hexdigest() if ip else ''})
        except Exception as ex:
            logger.warning('[AUTH] Analytics on register: %s', ex)
        ref = RefreshToken.for_user(user)
        return Response({'access': str(ref.access_token), 'refresh': str(ref), 'user': {'id': str(user.id), 'email': user.email, 'first_name': user.first_name, 'role': user.role}}, status=201)

class MeView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request): return Response(UserMeSerializer(request.user).data)
    def patch(self, request):
        s = UserMeSerializer(request.user, data=request.data, partial=True)
        if s.is_valid(): s.save(); return Response(s.data)
        return Response(s.errors, status=400)

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        s = ChangePasswordSerializer(data=request.data, context={'request': request})
        if not s.is_valid(): return Response(s.errors, status=400)
        request.user.set_password(s.validated_data['new_password'])
        request.user.save(update_fields=['password'])
        cache.set(f'force_logout:{request.user.id}', True, 86400 * 7)
        return Response({'detail': 'Contraseña actualizada.'})
