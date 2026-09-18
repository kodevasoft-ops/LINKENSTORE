import os
import django
from django.core.asgi import get_asgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'katalog.settings')
django.setup()
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.urls import re_path
from apps.core.auth.middleware import JWTAuthMiddlewareStack
from apps.core.consumers import NotificationConsumer
websocket_urlpatterns = [re_path(r'^ws/notifications/$', NotificationConsumer.as_asgi())]
application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': AllowedHostsOriginValidator(JWTAuthMiddlewareStack(URLRouter(websocket_urlpatterns))),
})
