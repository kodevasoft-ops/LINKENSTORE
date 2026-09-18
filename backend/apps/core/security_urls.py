import json, logging
from django.urls import path
from django.http import HttpResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
logger = logging.getLogger('katalog.security')

@method_decorator(csrf_exempt, name='dispatch')
class CSPReportView(View):
    def post(self, request, *args, **kwargs):
        try:
            body = json.loads(request.body)
            report = body.get('csp-report', body)
            logger.warning('[CSP] blocked=%s directive=%s', report.get('blocked-uri'), report.get('violated-directive'))
        except Exception: pass
        return HttpResponse(status=204)

urlpatterns = [path('csp-report/', CSPReportView.as_view(), name='csp-report')]
