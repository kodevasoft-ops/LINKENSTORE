from django.urls import path
from django.http import JsonResponse
from django.views import View
from django.db import connection
from django.core.cache import cache

class HealthView(View):
    def get(self, request):
        checks, healthy = {}, True
        try:
            with connection.cursor() as c: c.execute('SELECT 1')
            checks['database'] = 'ok'
        except Exception as e:
            checks['database'] = str(e); healthy = False
        try:
            cache.set('hc', '1', timeout=5)
            checks['redis'] = 'ok' if cache.get('hc') == '1' else 'error'
        except Exception as e:
            checks['redis'] = str(e); healthy = False
        return JsonResponse({'status': 'healthy' if healthy else 'unhealthy', 'checks': checks}, status=200 if healthy else 503)

class AliveView(View):
    def get(self, request): return JsonResponse({'status': 'alive'})

urlpatterns = [
    path('health/', HealthView.as_view(), name='health'),
    path('alive/',  AliveView.as_view(),  name='alive'),
]
