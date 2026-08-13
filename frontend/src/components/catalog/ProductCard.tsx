'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, ShoppingCart, Star, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import { useCartStore } from '@/store';
import { useAnalytics } from '@/hooks/useAnalytics';
import { ProductCardSkeleton } from '@/components/ui/Skeletons';
import api from '@/lib/api';

export interface Product {
  id:            string;
  slug:          string;
  name:          string;
  price:         number;
  compare_at?:   number | null;
  image?:        string;
  area_name?:    string;
  brand_name?:   string;
  stock:         number;
  rating?:       number;
  reviews_count?: number;
}

function discountPct(price: number, compareAt?: number | null): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round((1 - price / compareAt) * 100);
}

export function ProductCard({ product }: { product: Product }) {
  const { addItem }    = useCartStore();
  const { trackCart }  = useAnalytics();
  const [wished,    setWished]    = useState(false);
  const [adding,    setAdding]    = useState(false);

  const pct       = discountPct(product.price, product.compare_at);
  const outOfStock = product.stock <= 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (outOfStock || adding) return;
    setAdding(true);
    addItem({ id: product.id, name: product.name, price: product.price, image: product.image, qty: 1 });
    trackCart('add_item', { itemsCount: 1, cartTotal: product.price, areaName: product.area_name });
    toast.success(`${product.name} añadido al carrito`);
    setTimeout(() => setAdding(false), 600);
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setWished(p => !p);
    api.post(`/api/v1/products/${product.id}/wishlist/`, {}).catch(() => {});
  };

  return (
    <Link href={`/product/${product.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div className="product-card">
        {/* Image */}
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ aspectRatio: '1', background: 'var(--bg-card-hover)', overflow: 'hidden' }}>
            {product.image
              ? <Image src={product.image} alt={product.name} width={300} height={300}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
                  className="product-img" />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={40} color="var(--text-muted)" />
                </div>
            }
          </div>

          {/* Badges */}
          <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {pct > 0 && (
              <span style={{
                background: 'var(--danger)', color: '#fff', fontSize: '0.7rem',
                fontWeight: 700, padding: '3px 8px', borderRadius: 99,
              }}>
                -{pct}%
              </span>
            )}
            {outOfStock && (
              <span style={{
                background: 'rgba(0,0,0,0.7)', color: 'var(--text-muted)', fontSize: '0.7rem',
                fontWeight: 600, padding: '3px 8px', borderRadius: 99,
              }}>
                Sin stock
              </span>
            )}
          </div>

          {/* Wishlist */}
          <button
            onClick={handleWishlist}
            style={{
              position: 'absolute', top: 10, right: 10,
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
              border: 'none', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s',
            }}
          >
            <Heart size={16} fill={wished ? '#ef4444' : 'none'} color={wished ? '#ef4444' : '#fff'} />
          </button>

          {/* Add to cart overlay */}
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)',
            display: 'flex', alignItems: 'flex-end', padding: 10,
            opacity: 0, transition: 'opacity 0.2s',
          }} className="card-overlay">
            <button
              onClick={handleAddToCart}
              disabled={outOfStock || adding}
              className="btn btn-primary btn-full btn-sm"
              style={{ gap: 6 }}
            >
              <ShoppingCart size={14} />
              {adding ? 'Añadido' : outOfStock ? 'Sin stock' : 'Añadir'}
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="product-card-body">
          {product.brand_name && (
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
              {product.brand_name}
            </p>
          )}
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
            {product.name}
          </p>

          {product.rating !== undefined && product.rating > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <Star size={12} fill="var(--warning)" color="var(--warning)" />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{product.rating.toFixed(1)}</span>
              {product.reviews_count !== undefined && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({product.reviews_count})</span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              ${Number(product.price).toLocaleString('es-CO')}
            </span>
            {pct > 0 && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>
                ${Number(product.compare_at).toLocaleString('es-CO')}
              </span>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .product-card:hover .card-overlay { opacity: 1 !important; }
        .product-card:hover .product-img  { transform: scale(1.05); }
      `}</style>
    </Link>
  );
}

// Featured Products section for homepage
const fetcher = (url: string) => api.get(url).then(r => r.data);

export function FeaturedProducts() {
  const { data, isLoading } = useSWR<{ results: Product[] }>('/api/v1/products/featured/?limit=8', fetcher);
  const products = data?.results ?? [];

  return (
    <section style={{ padding: '48px 0' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Productos Destacados</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>Lo más popular esta semana</p>
          </div>
          <Link href="/catalog" style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            Ver catálogo
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : products.map(p => <ProductCard key={p.id} product={p} />)
          }
        </div>
      </div>
    </section>
  );
}
