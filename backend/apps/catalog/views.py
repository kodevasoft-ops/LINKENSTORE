"""
apps/catalog/views.py
SECURITY:
- ProductViewSet: create/update/delete solo IsAdministrador — explícito en cada action
- El catálogo público solo muestra productos con show_in_catalog=True (curación por Excel o manual)
- search_suggestions: rate limited, sin exponer campos internos (cost, etc.)
- reviews: un usuario = una reseña (upsert)
- wishlist: requiere auth
- Vendedor/Administrador solo pueden crear/editar productos de SU PROPIO punto
"""
import logging
from django.db import transaction
from django.db.models import Q, F, Avg
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
from apps.core.permissions import IsAdministrador, scoped_to_own_punto
from apps.core.throttling import PublicCatalogThrottle
from .models import Area, Brand, Product, Review, ProductImage, CatalogImport
from .serializers import (
    AreaSerializer, BrandSerializer,
    ProductListSerializer, ProductDetailSerializer, ProductManageSerializer,
    ReviewSerializer, CatalogImportSerializer,
)

logger = logging.getLogger('katalog.catalog')


class AreaViewSet(viewsets.ModelViewSet):
    queryset           = Area.objects.filter(is_active=True).order_by('order', 'name')
    serializer_class   = AreaSerializer
    http_method_names  = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'sync_tns'):
            return [IsAdministrador()]
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

    @action(detail=True, methods=['post'], url_path='sync-tns', permission_classes=[IsAdministrador])
    def sync_tns(self, request, pk=None):
        from apps.catalog.tasks import sync_tns_products
        area = self.get_object()
        import hashlib as _hl
        task_id = _hl.sha256(f'tns_sync_{area.id}_{request.data.get("nonce", "")}'.encode()).hexdigest()[:32]
        sync_tns_products.apply_async(kwargs={'area_id': str(area.id)}, task_id=task_id)
        logger.info('[TNS] Sync manual disparado para area=%s por %s', area.slug, request.user.email)
        return Response({'detail': 'Sincronización iniciada.'})


class BrandViewSet(viewsets.ModelViewSet):
    queryset           = Brand.objects.filter(is_active=True).order_by('name')
    serializer_class   = BrandSerializer
    http_method_names  = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdministrador()]
        return [AllowAny()]


class ProductViewSet(viewsets.ModelViewSet):
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    lookup_field      = 'slug'

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'upload_image', 'delete_image',
                          'set_catalog_visibility', 'set_catalog_visibility_bulk',
                          'importar_excel', 'exportar_excel', 'importaciones'):
            return [IsAdministrador()]
        if self.action == 'wishlist':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_throttles(self):
        if self.action in ('search_suggestions', 'list', 'featured'):
            return [PublicCatalogThrottle()]
        return super().get_throttles()

    def _is_internal_request(self, request) -> bool:
        """
        Única fuente de verdad para decidir si esta request ve el inventario
        completo (incluye costo, ocultos, etc.) — nunca confiar en el query
        param ?internal=1 por sí solo, siempre verificar rol autenticado real.
        """
        user = request.user
        return bool(
            request.query_params.get('internal') == '1' and
            user.is_authenticated and
            user.role in ('vendedor', 'administrador', 'supervisor', 'superadmin')
        )

    def get_queryset(self):
        qs = Product.objects.select_related('brand', 'category__area', 'punto')
        p  = self.request.query_params
        user = self.request.user

        if self._is_internal_request(self.request):
            qs = qs.all()
            if scoped_to_own_punto(user):
                qs = qs.filter(punto_id=user.punto_id)
        else:
            qs = qs.filter(is_active=True, show_in_catalog=True)

        if q := p.get('search', '').strip():
            if len(q) > 200:
                q = q[:200]
            qs = qs.filter(Q(name__icontains=q) | Q(sku__icontains=q) | Q(brand__name__icontains=q))

        if area  := p.get('area', '').strip():  qs = qs.filter(category__area__slug=area)
        if punto := p.get('punto', '').strip(): qs = qs.filter(punto__slug=punto)
        if brand := p.get('brand', '').strip(): qs = qs.filter(brand_id=brand)

        try:
            if pmin := p.get('price_min'): qs = qs.filter(price__gte=float(pmin))
            if pmax := p.get('price_max'): qs = qs.filter(price__lte=float(pmax))
        except (ValueError, TypeError):
            pass

        if p.get('in_stock') == 'true': qs = qs.filter(stock__gt=0)

        ordering = p.get('ordering', '-created_at')
        if ordering not in ('price', '-price', '-created_at', 'created_at', '-sold_count'):
            ordering = '-created_at'
        return qs.order_by(ordering)

    def get_serializer_class(self):
        if self._is_internal_request(self.request) or self.action in ('create', 'update', 'partial_update'):
            return ProductManageSerializer
        return ProductDetailSerializer if self.action == 'retrieve' else ProductListSerializer

    def perform_create(self, serializer):
        user = self.request.user
        # Vendedor/Administrador solo pueden crear productos para SU punto — nunca para otro.
        if scoped_to_own_punto(user):
            if not user.punto_id:
                raise ValidationError({'detail': 'Tu usuario no tiene un punto asignado.'})
            serializer.save(punto_id=user.punto_id)
        else:
            serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        instance = self.get_object()
        if scoped_to_own_punto(user) and str(instance.punto_id) != str(user.punto_id):
            raise PermissionDenied('No puedes editar productos de otro punto.')
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if scoped_to_own_punto(user) and str(instance.punto_id) != str(user.punto_id):
            raise PermissionDenied('No puedes eliminar productos de otro punto.')
        instance.delete()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        Product.objects.filter(pk=instance.pk).update(views_count=F('views_count') + 1)
        return Response(self.get_serializer(instance).data)

    @action(detail=True, methods=['post'], url_path='images', permission_classes=[IsAdministrador])
    def upload_image(self, request, slug=None):
        """
        Sube una imagen adicional al producto — respeta el límite de
        MAX_PRODUCT_IMAGES (4) definido en settings, sin importar cuántas
        veces se llame este endpoint.
        """
        product = self.get_object()
        if scoped_to_own_punto(request.user) and str(product.punto_id) != str(request.user.punto_id):
            return Response({'detail': 'No puedes editar productos de otro punto.'}, status=403)

        max_images = getattr(settings, 'MAX_PRODUCT_IMAGES', 4)
        current_count = product.images.count()
        if current_count >= max_images:
            return Response(
                {'detail': f'Este producto ya tiene el máximo de {max_images} fotos permitidas.'},
                status=400,
            )
        image = request.FILES.get('image')
        if not image:
            return Response({'detail': 'Imagen requerida.'}, status=400)

        order = current_count
        ProductImage.objects.create(product=product, image=image, order=order)
        return Response(ProductDetailSerializer(product).data, status=201)

    @action(detail=True, methods=['delete'], url_path='images/(?P<image_id>[^/.]+)', permission_classes=[IsAdministrador])
    def delete_image(self, request, slug=None, image_id=None):
        """Elimina una foto puntual — así el límite de 4 nunca deja a nadie 'atascado'."""
        product = self.get_object()
        if scoped_to_own_punto(request.user) and str(product.punto_id) != str(request.user.punto_id):
            return Response({'detail': 'No puedes editar productos de otro punto.'}, status=403)
        deleted, _ = ProductImage.objects.filter(id=image_id, product=product).delete()
        if not deleted:
            return Response({'detail': 'Imagen no encontrada.'}, status=404)
        return Response(ProductDetailSerializer(product).data)

    @action(detail=True, methods=['patch'], url_path='visibilidad', permission_classes=[IsAdministrador])
    def set_catalog_visibility(self, request, slug=None):
        """Toggle manual de show_in_catalog — además de la importación masiva por Excel."""
        product = self.get_object()
        if scoped_to_own_punto(request.user) and str(product.punto_id) != str(request.user.punto_id):
            return Response({'detail': 'No puedes editar productos de otro punto.'}, status=403)
        visible = bool(request.data.get('show_in_catalog'))
        product.show_in_catalog = visible
        product.save(update_fields=['show_in_catalog'])
        return Response({'show_in_catalog': product.show_in_catalog})

    @action(detail=False, methods=['post'], url_path='visibilidad-masiva', permission_classes=[IsAdministrador])
    def set_catalog_visibility_bulk(self, request):
        """
        Marca varios productos con checkbox en la lista y aplica 'mostrar' u
        'ocultar' de una sola vez — la forma rápida de curar el catálogo
        sin Excel, para cambios puntuales (agregar uno nuevo, quitar uno).
        """
        product_ids = request.data.get('product_ids') or []
        show = bool(request.data.get('show_in_catalog'))
        if not product_ids:
            return Response({'detail': 'Selecciona al menos un producto.'}, status=400)

        qs = Product.objects.filter(id__in=product_ids)
        if scoped_to_own_punto(request.user):
            qs = qs.filter(punto_id=request.user.punto_id)

        updated = qs.update(show_in_catalog=show)
        logger.info('[CATALOGO] Visibilidad masiva: %s productos → %s, por %s',
                    updated, 'visible' if show else 'oculto', request.user.email)
        return Response({'actualizados': updated, 'show_in_catalog': show})

    @action(detail=False, methods=['get'], url_path='exportar-excel', permission_classes=[IsAdministrador])
    def exportar_excel(self, request):
        """
        Descarga el inventario completo del punto en Excel — pensado para que
        el Administrador lo revise/marque offline y lo vuelva a subir con
        'importar-excel'. Un paso más allá de solo importar: nunca hay que
        adivinar el formato exacto, porque el propio sistema lo genera.
        """
        import openpyxl
        from openpyxl.styles import Font, PatternFill
        from django.http import HttpResponse

        user = request.user
        qs = Product.objects.select_related('brand').all()
        if scoped_to_own_punto(user):
            qs = qs.filter(punto_id=user.punto_id)
        elif pf := request.query_params.get('punto'):
            qs = qs.filter(punto__slug=pf)

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'Inventario'
        headers = ['sku', 'nombre', 'marca', 'precio', 'stock', 'mostrar_en_catalogo']
        ws.append(headers)
        for cell in ws[1]:
            cell.font = Font(bold=True, color='FFFFFF')
            cell.fill = PatternFill(start_color='ADAD03', end_color='ADAD03', fill_type='solid')

        for p in qs.order_by('name').iterator():
            ws.append([
                p.sku, p.name, p.brand.name if p.brand else '',
                float(p.price), p.stock, 'SI' if p.show_in_catalog else 'NO',
            ])
        for col in ws.columns:
            width = max((len(str(c.value)) for c in col if c.value is not None), default=10)
            ws.column_dimensions[col[0].column_letter].width = min(width + 4, 40)

        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="inventario_catalogo.xlsx"'
        wb.save(response)
        return response

    @action(detail=False, methods=['post'], url_path='importar-excel', permission_classes=[IsAdministrador])
    def importar_excel(self, request):
        """
        Marca como visibles en el catálogo público, EN LOTE, todos los SKUs
        de un Excel que ya tienes armado — así no hay que ir uno por uno.

        Modo 'append' (el normal, y el que se usa casi siempre): SOLO agrega
        esos SKUs a los que ya están visibles. Nunca oculta nada por sí solo.

        Modo 'replace' (poco frecuente, requiere confirmación explícita):
        dejar visibles ÚNICAMENTE los SKUs del archivo, ocultando el resto.
        Úsalo solo si de verdad quieres reiniciar la selección desde cero.

        Para casos puntuales — agregar un producto nuevo o quitar uno — no
        hace falta Excel: se marca la casilla en la lista (una o varias a la
        vez) y se aplica con el botón de 'Mostrar/Ocultar seleccionados'.

        En el CRM de inventario interno TODOS los productos siguen apareciendo
        siempre — esto solo afecta lo que ve el cliente en el catálogo público.
        """
        import openpyxl

        user = request.user
        file = request.FILES.get('file')
        mode = request.data.get('mode', 'append')
        if mode not in ('replace', 'append'):
            return Response({'detail': "mode debe ser 'replace' o 'append'."}, status=400)
        # SEGURIDAD: 'replace' oculta TODO lo que no esté en el archivo — exige
        # confirmación explícita para que nunca sea un accidente de un clic.
        if mode == 'replace' and not request.data.get('confirm_replace'):
            return Response({
                'detail': "El modo 'reemplazar' oculta todos los productos que no estén en el archivo. "
                          "Envía confirm_replace=true para confirmar esta acción.",
            }, status=400)
        if not file:
            return Response({'detail': 'Archivo Excel requerido.'}, status=400)
        if not file.name.lower().endswith(('.xlsx', '.xlsm')):
            return Response({'detail': 'Solo se aceptan archivos .xlsx.'}, status=400)

        try:
            wb = openpyxl.load_workbook(file, read_only=True, data_only=True)
            ws = wb.active
        except Exception:
            return Response({'detail': 'No se pudo leer el archivo. ¿Es un Excel válido?'}, status=400)

        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return Response({'detail': 'El archivo está vacío.'}, status=400)

        header = [str(c).strip().lower() if c else '' for c in rows[0]]
        if 'sku' not in header:
            return Response({'detail': "El archivo debe tener una columna llamada 'sku'."}, status=400)
        sku_col = header.index('sku')

        skus_excel = []
        for row in rows[1:]:
            if row and len(row) > sku_col and row[sku_col]:
                skus_excel.append(str(row[sku_col]).strip())
        skus_excel = list(dict.fromkeys(s for s in skus_excel if s))  # dedup preservando orden

        if not skus_excel:
            return Response({'detail': 'No se encontraron SKUs en el archivo.'}, status=400)

        base_qs = Product.objects.all()
        if scoped_to_own_punto(user):
            base_qs = base_qs.filter(punto_id=user.punto_id)

        found_qs = base_qs.filter(sku__in=skus_excel)
        found_skus = set(found_qs.values_list('sku', flat=True))
        missing_skus = [s for s in skus_excel if s not in found_skus]

        with transaction.atomic():
            if mode == 'replace':
                base_qs.exclude(sku__in=skus_excel).update(show_in_catalog=False)
            found_qs.update(show_in_catalog=True)

        import_log = CatalogImport.objects.create(
            punto=user.punto if scoped_to_own_punto(user) else None,
            uploaded_by=user,
            file_name=file.name,
            mode=mode,
            skus_found=len(found_skus),
            skus_missing=len(missing_skus),
        )
        logger.info('[CATALOGO] Import Excel: %s SKUs encontrados, %s no encontrados, modo=%s, por %s',
                    len(found_skus), len(missing_skus), mode, user.email)

        return Response({
            'id': str(import_log.id),
            'mode': mode,
            'skus_procesados': len(skus_excel),
            'skus_encontrados': len(found_skus),
            'skus_no_encontrados': len(missing_skus),
            'skus_faltantes': missing_skus[:50],  # muestra hasta 50 para revisión rápida
        }, status=201)

    @action(detail=False, methods=['get'], url_path='importaciones', permission_classes=[IsAdministrador])
    def importaciones(self, request):
        """Historial de importaciones — auditoría de quién curó el catálogo y cuándo."""
        user = request.user
        qs = CatalogImport.objects.select_related('uploaded_by', 'punto').order_by('-created_at')
        if scoped_to_own_punto(user):
            qs = qs.filter(punto_id=user.punto_id)
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(CatalogImportSerializer(page, many=True).data)
        return Response(CatalogImportSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'], url_path='featured', permission_classes=[AllowAny])
    def featured(self, request):
        from django.core.cache import cache
        limit = min(int(request.query_params.get('limit', 8)), 24)
        cache_key = f'catalog_featured_{limit}'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        qs = self.get_queryset().filter(is_featured=True).order_by('-sold_count')[:limit]
        results = list(qs)
        if len(results) < limit:
            extra_ids = [p.id for p in results]
            extra = self.get_queryset().exclude(id__in=extra_ids).order_by('-sold_count')[:limit - len(results)]
            results += list(extra)
        data = {'results': ProductListSerializer(results, many=True).data}
        cache.set(cache_key, data, 60)
        return Response(data)

    @action(detail=False, methods=['get'], url_path='search-suggestions', permission_classes=[AllowAny])
    def search_suggestions(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2 or len(q) > 100:
            return Response({'results': []})
        limit = min(int(request.query_params.get('limit', 6)), 10)
        qs = self.get_queryset().filter(Q(name__icontains=q) | Q(brand__name__icontains=q))[:limit]
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
        if not request.user.is_authenticated:
            return Response({'detail': 'Autenticación requerida.'}, status=401)
        s = ReviewSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        review, created = Review.objects.update_or_create(
            product=product, user=request.user,
            defaults={'rating': s.validated_data['rating'], 'comment': s.validated_data.get('comment', '')[:1000]},
        )
        return Response(ReviewSerializer(review).data, status=201 if created else 200)

    @action(detail=True, methods=['post'], url_path='wishlist', permission_classes=[IsAuthenticated])
    def wishlist(self, request, slug=None):
        product = self.get_object()
        Product.objects.filter(pk=product.pk).update(wishlist_count=F('wishlist_count') + 1)
        return Response({'detail': 'Añadido a favoritos.'})
