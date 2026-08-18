"""
apps/catalog/views.py
SECURITY:
- ProductViewSet: create/update/delete solo IsAdmin — explícito en cada action
- search_suggestions: rate limited, sin exponer campos internos (cost, etc.)
- reviews: un usuario = una reseña (upsert)
- wishlist: requiere auth
- No raw SQL, no user input en queries sin ORM
"""
import logging
from django.db.models import Q, F, Avg
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from apps.core.permissions import IsAdmin
from apps.core.throttling import PublicCatalogThrottle
from .models import Area, Brand, Product, Review
from .serializers import (
    AreaSerializer, BrandSerializer,
    ProductListSerializer, ProductDetailSerializer,
    ReviewSerializer,
)

logger = logging.getLogger('katalog.catalog')


class AreaViewSet(viewsets.ModelViewSet):
    queryset           = Area.objects.filter(is_active=True).order_by('order', 'name')
    serializer_class   = AreaSerializer
    http_method_names  = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'sync_tns'):
            return [IsAdmin()]
        return [AllowAny()]

    @action(detail=False, methods=['get'], url_path='menu', permission_classes=[AllowAny])
    def menu(self, request):
        from django.core.cache import cache
        cache_key = 'catalog_areas_menu'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        areas = self.get_queryset()
        data = AreaSerializer(areas, many=True).data
        cache.set(cache_key, data, 120)  # 2 min cache
        return Response(data)

    @action(detail=True, methods=['post'], url_path='sync-tns', permission_classes=[IsAdmin])
    def sync_tns(self, request, pk=None):
        from apps.catalog.tasks import sync_tns_products
        area = self.get_object()
        import hashlib as _hl
        area_obj = self.get_object()
        task_id = _hl.sha256(f'tns_sync_{area_obj.id}'.encode()).hexdigest()[:32]
        sync_tns_products.apply_async(
            kwargs={'area_id': str(area_obj.id)},
            task_id=task_id
        )
        logger.info('[TNS] Sync triggered for area=%s by %s', area.slug, request.user.email)
        return Response({'detail': 'Sincronización iniciada.'})


class BrandViewSet(viewsets.ModelViewSet):
    queryset           = Brand.objects.filter(is_active=True).order_by('name')
    serializer_class   = BrandSerializer
    http_method_names  = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdmin()]
        return [AllowAny()]


class ProductViewSet(viewsets.ModelViewSet):
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    lookup_field      = 'slug'

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdmin()]
        if self.action == 'wishlist':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_throttles(self):
        if self.action in ('search_suggestions', 'list', 'featured'):
            return [PublicCatalogThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        qs = Product.objects.filter(is_active=True).select_related('brand', 'category__area')
        p  = self.request.query_params

        # Search — ORM only, no raw SQL
        if q := p.get('search', '').strip():
            if len(q) > 200:  # Prevent extremely long queries
                q = q[:200]
            qs = qs.filter(Q(name__icontains=q) | Q(sku__icontains=q) | Q(brand__name__icontains=q))

        if area  := p.get('area', '').strip():  qs = qs.filter(category__area__slug=area)
        if brand := p.get('brand', '').strip(): qs = qs.filter(brand_id=brand)

        # Price filters — validate numeric
        try:
            if pmin := p.get('price_min'): qs = qs.filter(price__gte=float(pmin))
            if pmax := p.get('price_max'): qs = qs.filter(price__lte=float(pmax))
        except (ValueError, TypeError):
            pass  # Invalid price params — ignore silently

        if p.get('in_stock') == 'true': qs = qs.filter(stock__gt=0)

        # Safe ordering whitelist
        ordering = p.get('ordering', '-created_at')
        if ordering not in ('price', '-price', '-created_at', 'created_at', '-sold_count'):
            ordering = '-created_at'
        return qs.order_by(ordering)

    def get_serializer_class(self):
        return ProductDetailSerializer if self.action == 'retrieve' else ProductListSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Atomic increment — no race condition
        Product.objects.filter(pk=instance.pk).update(views_count=F('views_count') + 1)
        return Response(self.get_serializer(instance).data)

    @action(detail=False, methods=['get'], url_path='featured', permission_classes=[AllowAny])
    def featured(self, request):
        from django.core.cache import cache
        limit = min(int(request.query_params.get('limit', 8)), 24)
        cache_key = f'catalog_featured_{limit}'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)  # max 24
        qs = self.get_queryset().filter(is_featured=True).order_by('-sold_count')[:limit]
        results = list(qs)
        if len(results) < limit:
            extra_ids = [p.id for p in results]
            extra = self.get_queryset().exclude(id__in=extra_ids).order_by('-sold_count')[:limit - len(results)]
            results += list(extra)
        data = {'results': ProductListSerializer(results, many=True).data}
        cache.set(cache_key, data, 60)  # 1 min cache
        return Response(data)

    @action(detail=False, methods=['get'], url_path='search-suggestions', permission_classes=[AllowAny])
    def search_suggestions(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2 or len(q) > 100:
            return Response({'results': []})
        limit = min(int(request.query_params.get('limit', 6)), 10)
        qs = self.get_queryset().filter(
            Q(name__icontains=q) | Q(brand__name__icontains=q)
        )[:limit]
        # Only expose safe public fields — no cost, no internal data
        results = [{
            'slug':  p.slug,
            'name':  p.name,
            'area':  p.category.area.name if p.category else '',
            'price': str(p.price),
            'image': p.main_image,
        } for p in qs]
        return Response({'results': results})

    @action(detail=True, methods=['get'], url_path='related', permission_classes=[AllowAny])
    def related(self, request, slug=None):
        product = self.get_object()
        qs = self.get_queryset().exclude(pk=product.pk)
        if product.category_id:
            qs = qs.filter(category_id=product.category_id)
        elif product.brand_id:
            qs = qs.filter(brand_id=product.brand_id)
        return Response({'results': ProductListSerializer(qs.order_by('-sold_count')[:8], many=True).data})

    @action(detail=True, methods=['get', 'post'], url_path='reviews', permission_classes=[AllowAny])
    def reviews(self, request, slug=None):
        product = self.get_object()
        if request.method == 'GET':
            qs = product.reviews.select_related('user').all()
            return Response({'results': ReviewSerializer(qs, many=True).data})
        # POST: requires authentication
        if not request.user.is_authenticated:
            return Response({'detail': 'Autenticación requerida.'}, status=401)
        s = ReviewSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        # One review per user per product (upsert)
        review, created = Review.objects.update_or_create(
            product=product, user=request.user,
            defaults={
                'rating':  s.validated_data['rating'],
                'comment': s.validated_data.get('comment', '')[:1000],
            }
        )
        return Response(ReviewSerializer(review).data, status=201 if created else 200)

    @action(detail=True, methods=['post'], url_path='wishlist', permission_classes=[IsAuthenticated])
    def wishlist(self, request, slug=None):
        product = self.get_object()
        Product.objects.filter(pk=product.pk).update(wishlist_count=F('wishlist_count') + 1)
        return Response({'detail': 'Añadido a favoritos.'})
