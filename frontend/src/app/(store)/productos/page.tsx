'use client';

import { useEffect, useState, useCallback } from 'react';
import { SlidersHorizontal, Loader2, PackageX } from 'lucide-react';
import { catalogApi, type Product, type ProductFilters, ApiError } from '@/lib/api';
import ProductCard from '@/components/product/ProductCard';

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProductFilters>({ ordering: '-created_at' });

  const load = useCallback(async (f: ProductFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await catalogApi.list(f);
      setProducts(data.results);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el catálogo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  return (
    <main className="wrap" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Catálogo</h1>
        <button
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}
          aria-label="Abrir filtros"
        >
          <SlidersHorizontal size={16} /> Filtros
        </button>
      </div>

      <input
        type="search"
        placeholder="Buscar producto, marca o SKU..."
        onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        style={{
          width: '100%', padding: '12px 16px', borderRadius: 12, marginBottom: 24,
          background: 'var(--surf)', border: '1px solid var(--bdr2)', color: 'var(--txt)',
        }}
      />

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: 'var(--muted)' }}>
          <Loader2 size={24} className="spin" />
        </div>
      )}

      {!loading && error && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
          <PackageX size={32} style={{ margin: '0 auto 12px' }} />
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
          <PackageX size={32} style={{ margin: '0 auto 12px' }} />
          <p>No encontramos productos con esos filtros.</p>
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 20,
          }}
        >
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}
