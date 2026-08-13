"""
apps/analytics/views.py
SECURITY:
- Track endpoints: AllowAny pero con rate limiting + IP hashing (no raw IPs)
- Admin endpoints: IsAuthenticated + IsAdmin
- Session IDs sanitizados
- No expone datos de usuarios individuales
"""
import hashlib, logging
from datetime import timedelta, date
from django.db.models import Count, Sum, Avg, Q
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from apps.core.permissions import IsAdmin
from .models import (SearchEvent, PageView, CartEvent,
                     CartAbandonment, CustomerRegistration, DailySummary)
from .serializers import (TrackSearchSerializer, TrackPageViewSerializer,
                          TrackCartSerializer, CartAbandonmentSerializer,
                          DailySummarySerializer)

logger = logging.getLogger('katalog.analytics')


class AnalyticsPublicThrottle(AnonRateThrottle):
    """120 requests/min per IP for public tracking endpoints."""
    scope = 'analytics_public'
    rate  = '120/min'


def _ip_hash(request) -> str:
    """SHA-256 hash of IP — never store raw IP (GDPR)."""
    ip = request.META.get('HTTP_X_REAL_IP') or \
         request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or \
         request.META.get('REMOTE_ADDR', '')
    return hashlib.sha256(ip.encode()).hexdigest() if ip else ''


def _sanitize_session(sid: str) -> str:
    """Sanitize session ID — alphanumeric + dash only, max 64 chars."""
    import re
    return re.sub(r'[^a-zA-Z0-9\-_]', '', str(sid))[:64]


class TrackSearchView(APIView):
    permission_classes = [AllowAny]
    throttle_classes   = [AnalyticsPublicThrottle]

    def post(self, request):
        s = TrackSearchSerializer(data=request.data)
        if not s.is_valid():
            return Response({'ok': False}, status=400)
        d       = s.validated_data
        session = _sanitize_session(d.get('session_id', ''))
        query   = d['query'].strip()[:300]

        # Dedup: same query + session in last 5 min
        cutoff = timezone.now() - timedelta(minutes=5)
        if not SearchEvent.objects.filter(
            session_id=session, query=query, created_at__gte=cutoff
        ).exists():
            SearchEvent.objects.create(
                query         = query,
                results_count = max(0, d.get('results_count', 0)),
                ip_hash       = _ip_hash(request),
                session_id    = session,
                area_slug     = d.get('area_slug', '')[:100],
                user          = request.user if request.user.is_authenticated else None,
            )
        return Response({'ok': True})


class TrackPageViewView(APIView):
    permission_classes = [AllowAny]
    throttle_classes   = [AnalyticsPublicThrottle]

    def post(self, request):
        s = TrackPageViewSerializer(data=request.data)
        if not s.is_valid():
            return Response({'ok': False}, status=400)
        d = s.validated_data
        PageView.objects.create(
            ip_hash    = _ip_hash(request),
            path       = d['path'][:500],
            referrer   = d.get('referrer', '')[:500],
            session_id = _sanitize_session(d.get('session_id', '')),
            user       = request.user if request.user.is_authenticated else None,
        )
        return Response({'ok': True})


class TrackCartEventView(APIView):
    permission_classes = [AllowAny]
    throttle_classes   = [AnalyticsPublicThrottle]

    VALID_EVENT_TYPES = {
        'add_item', 'remove_item', 'update_qty',
        'view_cart', 'start_checkout', 'abandon_cart', 'complete_order'
    }

    def post(self, request):
        s = TrackCartSerializer(data=request.data)
        if not s.is_valid():
            return Response({'ok': False}, status=400)
        d = s.validated_data
        # Whitelist event types
        if d['event_type'] not in self.VALID_EVENT_TYPES:
            return Response({'ok': False, 'detail': 'event_type inválido.'}, status=400)
        CartEvent.objects.create(
            event_type         = d['event_type'],
            session_id         = _sanitize_session(d['session_id']),
            ip_hash            = _ip_hash(request),
            cart_items_count   = max(0, min(d.get('cart_items_count', 0), 999)),
            cart_total         = max(0, d.get('cart_total', 0)),
            area_name          = d.get('area_name', '')[:100],
            inactivity_seconds = d.get('inactivity_seconds'),
            user               = request.user if request.user.is_authenticated else None,
        )
        return Response({'ok': True})


class TrackAbandonmentView(APIView):
    permission_classes = [AllowAny]
    throttle_classes   = [AnalyticsPublicThrottle]

    def post(self, request):
        session = _sanitize_session(request.data.get('session_id', ''))
        if not session:
            return Response({'ok': False}, status=400)
        email      = str(request.data.get('email', ''))[:254]
        cart_total = max(0, float(request.data.get('cart_total', 0)))
        items      = max(0, int(request.data.get('items_count', 0)))
        last_step  = str(request.data.get('last_step', 'cart'))[:30]
        time_cart  = max(0, int(request.data.get('time_in_cart_seconds', 0)))

        CartAbandonment.objects.update_or_create(
            session_id = session,
            status     = 'abandoned',
            defaults   = {
                'email':                 email,
                'cart_total':            cart_total,
                'items_count':           items,
                'last_step':             last_step,
                'time_in_cart_seconds':  time_cart,
                'user': request.user if request.user.is_authenticated else None,
            }
        )
        return Response({'ok': True})


class AnalyticsDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        today    = date.today()
        week_ago = today - timedelta(days=7)
        return Response({
            'searches_today':    SearchEvent.objects.filter(created_at__date=today).count(),
            'pageviews_today':   PageView.objects.filter(created_at__date=today).count(),
            'carts_today':       CartEvent.objects.filter(event_type='add_item', created_at__date=today)
                                          .values('session_id').distinct().count(),
            'new_customers_week': CustomerRegistration.objects.filter(created_at__date__gte=week_ago).count(),
        })


class SearchTrafficView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        days   = min(int(request.query_params.get('period', '30').replace('d', '')), 365)
        limit  = min(int(request.query_params.get('limit', 15)), 50)
        cutoff = timezone.now() - timedelta(days=days)

        top_queries = list(
            SearchEvent.objects.filter(created_at__gte=cutoff)
            .values('query')
            .annotate(count=Count('id'), unique_ips=Count('ip_hash', distinct=True), avg_results=Avg('results_count'))
            .order_by('-count')[:limit]
        )
        zero_results = list(
            SearchEvent.objects.filter(created_at__gte=cutoff, results_count=0)
            .values('query').annotate(count=Count('id')).order_by('-count')[:limit]
        )
        # Hourly grouped — using date_trunc safe via extra
        from django.db.models.functions import TruncHour
        hourly = list(
            SearchEvent.objects.filter(created_at__gte=cutoff)
            .annotate(hour=TruncHour('created_at'))
            .values('hour')
            .annotate(count=Count('id'), unique=Count('ip_hash', distinct=True))
            .order_by('hour')[:168]  # max 7 days of hours
        )
        # Serialize datetime
        for h in hourly:
            h['hour'] = h['hour'].isoformat() if h['hour'] else None

        return Response({
            'period_days': days,
            'top_queries': top_queries,
            'zero_results': zero_results,
            'hourly': hourly,
        })


class CartAbandonmentListView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        per_page = min(int(request.query_params.get('limit', 25)), 100)
        sf       = request.query_params.get('status', '')
        qs       = CartAbandonment.objects.order_by('-abandoned_at')
        if sf in ('abandoned', 'recovered', 'expired'):
            qs = qs.filter(status=sf)
        total    = qs.count()
        items    = qs[:per_page]
        all_qs   = CartAbandonment.objects.all()
        recovered = all_qs.filter(status='recovered').count()
        all_total = all_qs.count()
        rate      = round((recovered / max(all_total, 1)) * 100, 1)
        avg_val   = all_qs.aggregate(a=Avg('cart_total'))['a'] or 0
        return Response({
            'count':   total,
            'results': CartAbandonmentSerializer(items, many=True).data,
            'stats': {
                'total':     all_total,
                'recovered': recovered,
                'rate':      f'{rate}%',
                'avg_value': round(float(avg_val), 2),
            },
        })


class NewCustomersView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        days   = min(int(request.query_params.get('days', 30)), 365)
        cutoff = timezone.now() - timedelta(days=days)
        qs     = CustomerRegistration.objects.filter(created_at__gte=cutoff)
        by_src = dict(qs.values_list('source').annotate(c=Count('id')).values_list('source', 'c'))
        return Response({'total': qs.count(), 'by_source': by_src, 'results': []})


class DailySummaryView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        days   = min(int(request.query_params.get('days', 30)), 365)
        cutoff = date.today() - timedelta(days=days)
        qs     = DailySummary.objects.filter(date__gte=cutoff).order_by('-date')
        return Response({'results': DailySummarySerializer(qs, many=True).data})
