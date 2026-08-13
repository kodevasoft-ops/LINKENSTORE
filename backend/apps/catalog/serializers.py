from rest_framework import serializers
from .models import Area, Brand, Category, Product, ProductImage, Review

class AreaSerializer(serializers.ModelSerializer):
    products_count = serializers.SerializerMethodField()
    class Meta:
        model = Area
        fields = ['id','name','slug','icon','color','order','is_active','products_count']
        read_only_fields = ['id']
    def get_products_count(self, obj):
        return Product.objects.filter(category__area=obj, is_active=True).count()

class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ['id','name','slug','logo','is_active']
        read_only_fields = ['id']

class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.first_name', read_only=True)
    class Meta:
        model = Review
        fields = ['id','user_name','rating','comment','created_at']
        read_only_fields = ['id','user_name','created_at']

class ProductListSerializer(serializers.ModelSerializer):
    image         = serializers.SerializerMethodField()
    area_name     = serializers.CharField(source='category.area.name', read_only=True, default='')
    brand_name    = serializers.CharField(source='brand.name', read_only=True, default='')
    rating        = serializers.FloatField(source='rating_avg', read_only=True)
    reviews_count = serializers.SerializerMethodField()
    class Meta:
        model = Product
        fields = ['id','slug','name','price','compare_at','image','area_name','brand_name','stock','rating','reviews_count']
    def get_image(self, obj): return obj.main_image
    def get_reviews_count(self, obj): return obj.reviews.count()

class ProductDetailSerializer(ProductListSerializer):
    images = serializers.SerializerMethodField()
    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + ['description','specs','images','sku']
    def get_images(self, obj):
        return [i.image.url for i in obj.images.order_by('order') if i.image]
