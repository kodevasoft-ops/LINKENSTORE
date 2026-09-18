from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError

@database_sync_to_async
def get_user_from_token(token):
    from apps.core.models import User
    try:
        v = AccessToken(token)
        return User.objects.get(id=v['user_id'])
    except (TokenError, Exception):
        return AnonymousUser()

class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        params = parse_qs(scope.get('query_string', b'').decode())
        token  = (params.get('token') or [None])[0]
        scope['user'] = await get_user_from_token(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)

def JWTAuthMiddlewareStack(inner): return JWTAuthMiddleware(inner)
