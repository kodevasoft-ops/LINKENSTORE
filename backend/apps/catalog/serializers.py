from rest_framework import serializers
from .models import Area, Brand, CatalogImport, Product, ProductImage, Review


class AreaSerializer(serializers.ModelSerializer):
    products_count = serializers.SerializerMethodField()
    class Meta:
        model = Area
        fields = ['id', 'name', 'slug', 'icon', 'color', 'order', 'is_active', 'products_count']
        read_only_fields = ['id']
    def get_products_count(self, obj):
        return Product.objects.filter(category__area=obj, is_active=True, show_in_catalog=True).count()


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ['id', 'name', 'slug', 'logo', 'is_active']
        read_only_fields = ['id']


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.first_name', read_only=True)
    class Meta:
        model = Review
        fields = ['id', 'user_name', 'rating', 'comment', 'created_at']
        read_only_fields = ['id', 'user_name', 'created_at']


class ProductListSerializer(serializers.ModelSerializer):
    image         = serializers.SerializerMethodField()
    area_name     = serializers.CharField(source='category.area.name', read_only=True, default='')
    brand_name    = serializers.CharField(source='brand.name', read_only=True, default='')
    punto_name    = serializers.CharField(source='punto.name', read_only=True, default='')
    punto_slug    = serializers.CharField(source='punto.slug', read_only=True, default='')
    rating        = serializers.FloatField(source='rating_avg', read_only=True)
    reviews_count = serializers.SerializerMethodField()
    effective_price = serializers.DecimalField(source='effective_price', max_digits=14, decimal_places=2, read_only=True)
    on_promotion  = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'slug', 'name', 'price', 'compare_at', 'effective_price', 'on_promotion', 'image',
                  'area_name', 'brand_name', 'punto_name', 'punto_slug', 'stock', 'rating', 'reviews_count',
                  'is_active', 'show_in_catalog']

    def get_image(self, obj): return obj.main_image
    def get_reviews_count(self, obj): return obj.reviews.count()
    def get_on_promotion(self, obj): return obj.active_promotion is not None


class ProductDetailSerializer(ProductListSerializer):
    images     = serializers.SerializerMethodField()
    images_count = serializers.SerializerMethodField()

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + ['description', 'specs', 'images', 'images_count', 'sku', 'punto']

    def get_images(self, obj):
        return [{'id': str(i.id), 'url': i.image.url} for i in obj.images.order_by('order') if i.image]

    def get_images_count(self, obj):
        return obj.images.count()


class ProductManageSerializer(ProductDetailSerializer):
    """
    SOLO para vistas internas de gestión (crear/editar, ?internal=1 verificado
    por rol) — NUNCA usar en endpoints públicos. Expone 'cost' (costo interno,
    revela margen de ganancia) y campos operativos que el catálogo público
    jamás debe ver.
    """
    class Meta(ProductDetailSerializer.Meta):
        fields = ProductDetailSerializer.Meta.fields + ['cost', 'min_stock', 'is_featured', 'brand', 'category']


class CatalogImportSerializer(serializers.ModelSerializer):
    punto_name    = serializers.CharField(source='punto.name', read_only=True, default='')
    uploaded_by_name = serializers.CharField(source='uploaded_by.full_name', read_only=True, default='')
    mode_display  = serializers.CharField(source='get_mode_display', read_only=True)

    class Meta:
        model = CatalogImport
        fields = ['id', 'punto_name', 'uploaded_by_name', 'file_name', 'mode', 'mode_display',
                  'skus_found', 'skus_missing', 'created_at']


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'order']
        read_only_fields = ['id']