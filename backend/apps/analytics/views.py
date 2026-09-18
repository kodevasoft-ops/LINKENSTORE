"""
apps/analytics/views.py
SECURITY:
- Track endpoints: AllowAny pero con rate limiting + IP hashing (no raw IPs)
- Dashboards: IsAuthenticated + CanViewSalesReports (incluye Supervisor, que consulta todo)
- Session IDs sanitizados
- No expone datos de usuarios individuales
"""
import hashlib
from datetime import timedelta, date
from django.db.models import Count, Avg
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from apps.core.permissions import CanViewSalesReports, IsSupervisorOrAbove
from .models import SearchEvent, PageView, CartEvent, CartAbandonment, CustomerRegistration, DailySummary
from .serializers import (TrackSearchSerializer, TrackPageViewSerializer,
                          TrackCartSerializer, CartAbandonmentSerializer,
                          DailySummarySerializer)


class AnalyticsPublicThrottle(AnonRateThrottle):
    """120 requests/min por IP para endpoints públicos de tracking."""
    scope = 'analytics_public'
    rate  = '120/min'


def _ip_hash(request) -> str:
    ip = request.META.get('HTTP_X_REAL_IP') or \
         request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or \
         request.META.get('REMOTE_ADDR', '')
    return hashlib.sha256(ip.encode()).hexdigest() if ip else ''


def _sanitize_session(sid: str) -> str:
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

        cutoff = timezone.now() - timedelta(minutes=5)
        if not SearchEvent.objects.filter(session_id=session, query=query, created_at__gte=cutoff).exists():
            SearchEvent.objects.create(
                query=query, results_count=max(0, d.get('results_count', 0)),
                ip_hash=_ip_hash(request), session_id=session,
                area_slug=d.get('area_slug', '')[:100],
                user=request.user if request.user.is_authenticated else None,
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
            ip_hash=_ip_hash(request), path=d['path'][:500],
            referrer=d.get('referrer', '')[:500], session_id=_sanitize_session(d.get('session_id', '')),
            user=request.user if request.user.is_authenticated else None,
        )
        return Response({'ok': True})


class TrackCartEventView(APIView):
    """
    NOTA DE RENDIMIENTO: bajo carga alta (miles de eventos/segundo), escribir
    a Postgres en cada request satura las conexiones de escritura. Por eso
    este endpoint solo hace un INSERT-rápido a Redis (operación en memoria,
    O(1)); el volcado real a Postgres ocurre en lote cada 30s vía
    'flush_analytics_buffer' en Celery Beat — igual que ya se hacía con
    los eventos de búsqueda.
    """
    permission_classes = [AllowAny]
    throttle_classes   = [AnalyticsPublicThrottle]

    VALID_EVENT_TYPES = {
        'add_item', 'remove_item', 'update_qty',
        'view_cart', 'start_checkout', 'abandon_cart', 'complete_order',
    }

    def post(self, request):
        s = TrackCartSerializer(data=request.data)
        if not s.is_valid():
            return Response({'ok': False}, status=400)
        d = s.validated_data
        if d['event_type'] not in self.VALID_EVENT_TYPES:
            return Response({'ok': False, 'detail': 'event_type inválido.'}, status=400)

        from django.core.cache import cache
        import json, uuid as _uuid
        payload = {
            'event_type': d['event_type'],
            'session_id': _sanitize_session(d['session_id']),
            'ip_hash': _ip_hash(request),
            'cart_items_count': max(0, min(d.get('cart_items_count', 0), 999)),
            'cart_total': str(max(0, d.get('cart_total', 0))),
            'area_name': d.get('area_name', '')[:100],
            'inactivity_seconds': d.get('inactivity_seconds'),
            'user_id': str(request.user.id) if request.user.is_authenticated else None,
        }
        # Cada evento se guarda con una key única — flush_analytics_buffer los
        # recoge todos por prefijo y los inserta a Postgres en un solo bulk_create.
        cache.set(f'analytics_buf:cart:{_uuid.uuid4().hex}', json.dumps(payload), timeout=120)
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
            session_id=session, status='abandoned',
            defaults={
                'email': email, 'cart_total': cart_total, 'items_count': items,
                'last_step': last_step, 'time_in_cart_seconds': time_cart,
                'user': request.user if request.user.is_authenticated else None,
            },
        )
        return Response({'ok': True})


class AnalyticsDashboardView(APIView):
    """Panel del Supervisor: gráficas y estadísticas al día — consulta todo, no opera nada."""
    permission_classes = [CanViewSalesReports]

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
    permission_classes = [CanViewSalesReports]

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
        from django.db.models.functions import TruncHour
        hourly = list(
            SearchEvent.objects.filter(created_at__gte=cutoff)
            .annotate(hour=TruncHour('created_at'))
            .values('hour')
            .annotate(count=Count('id'), unique=Count('ip_hash', distinct=True))
            .order_by('hour')[:168]
        )
        for h in hourly:
            h['hour'] = h['hour'].isoformat() if h['hour'] else None

        return Response({'period_days': days, 'top_queries': top_queries, 'zero_results': zero_results, 'hourly': hourly})


class CartAbandonmentListView(APIView):
    permission_classes = [CanViewSalesReports]

    def get(self, request):
        per_page = min(int(request.query_params.get('limit', 25)), 100)
        sf       = request.query_params.get('status', '')
        qs       = CartAbandonment.objects.order_by('-abandoned_at')
        if sf in ('abandoned', 'recovered', 'expired'):
            qs = qs.filter(status=sf)
        total     = qs.count()
        items     = qs[:per_page]
        all_qs    = CartAbandonment.objects.all()
        recovered = all_qs.filter(status='recovered').count()
        all_total = all_qs.count()
        rate      = round((recovered / max(all_total, 1)) * 100, 1)
        avg_val   = all_qs.aggregate(a=Avg('cart_total'))['a'] or 0
        return Response({
            'count':   total,
            'results': CartAbandonmentSerializer(items, many=True).data,
            'stats': {'total': all_total, 'recovered': recovered, 'rate': f'{rate}%', 'avg_value': round(float(avg_val), 2)},
        })


class NewCustomersView(APIView):
    permission_classes = [CanViewSalesReports]

    def get(self, request):
        days   = min(int(request.query_params.get('days', 30)), 365)
        cutoff = timezone.now() - timedelta(days=days)
        qs     = CustomerRegistration.objects.filter(created_at__gte=cutoff)
        by_src = dict(qs.values_list('source').annotate(c=Count('id')).values_list('source', 'c'))
        return Response({'total': qs.count(), 'by_source': by_src, 'results': []})


class DailySummaryView(APIView):
    permission_classes = [CanViewSalesReports]

    def get(self, request):
        days   = min(int(request.query_params.get('days', 30)), 365)
        cutoff = date.today() - timedelta(days=days)
        qs     = DailySummary.objects.filter(date__gte=cutoff).order_by('-date')
        return Response({'results': DailySummarySerializer(qs, many=True).data})


class SupervisorDashboardView(APIView):
    """
    Panel del Supervisor: gráficas y estadísticas de ventas al día, consulta
    TODO el negocio (todos los puntos) — pero es de solo lectura, nunca opera.
    SuperAdmin también lo usa (ve lo mismo, además de poder actuar desde
    sus propios paneles de gestión).
    RESTRINGIDO a supervisor/superadmin — Vendedor/Administrador NO deben ver
    el desglose cruzado de otros puntos.
    """
    permission_classes = [IsSupervisorOrAbove]

    def get(self, request):
        from django.db.models import Count, Sum
        from django.db.models.functions import TruncDate
        from apps.core.models import User
        from apps.catalog.models import Product
        from apps.orders.models import Order, RepairTicket

        REVENUE_STATUSES = ['paid', 'confirmed', 'shipped', 'delivered']
        today    = date.today()
        days_ago = today - timedelta(days=14)

        # ── Tendencia de ventas — últimos 14 días, para la gráfica principal ──
        daily = list(
            Order.objects.filter(status__in=REVENUE_STATUSES, created_at__date__gte=days_ago)
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(total=Sum('total'), count=Count('id'))
            .order_by('day')
        )
        # Rellena días sin ventas con 0 — para que la gráfica no tenga huecos engañosos
        daily_map = {d['day']: d for d in daily}
        trend = []
        for i in range(14, -1, -1):
            day = today - timedelta(days=i)
            row = daily_map.get(day)
            trend.append({
                'date':  day.isoformat(),
                'total': float(row['total']) if row else 0,
                'count': row['count'] if row else 0,
            })

        # ── Ventas y productos por punto ──────────────────────────────────
        ventas_por_punto = list(
            Order.objects.filter(status__in=REVENUE_STATUSES)
            .values('punto__name', 'punto__slug')
            .annotate(total=Sum('total'), count=Count('id'))
            .order_by('-total')
        )
        productos_por_punto = list(
            Product.objects.filter(is_active=True)
            .values('punto__name').annotate(total=Count('id')).order_by('-total')
        )

        # ── KPIs generales ─────────────────────────────────────────────────
        revenue_total_30d = Order.objects.filter(
            status__in=REVENUE_STATUSES, created_at__date__gte=today - timedelta(days=30)
        ).aggregate(t=Sum('total'))['t'] or 0
        revenue_hoy = Order.objects.filter(
            status__in=REVENUE_STATUSES, created_at__date=today
        ).aggregate(t=Sum('total'))['t'] or 0

        users_by_role = dict(User.objects.values_list('role').annotate(c=Count('id')).values_list('role', 'c'))

        return Response({
            'revenue_hoy':            float(revenue_hoy),
            'revenue_30d':            float(revenue_total_30d),
            'ventas_trend_14d':       trend,
            'ventas_por_punto':       ventas_por_punto,
            'productos_por_punto':    productos_por_punto,
            'users_by_role':          users_by_role,
            'ordenes_pendientes_tns': Order.objects.filter(status='paid', tns_confirmed=False).count(),
            'productos_stock_bajo':   Product.objects.filter(stock__lte=3, stock__gt=0, is_active=True).count(),
            'productos_sin_stock':    Product.objects.filter(stock=0, is_active=True).count(),
            'reparaciones_activas':   RepairTicket.objects.exclude(status__in=['delivered', 'cancelled']).count(),
        })
