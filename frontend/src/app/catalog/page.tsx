'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { SlidersHorizontal, Grid2X2, List, Search, X } from 'lucide-react';
import CatalogNavbar from '@/components/catalog/CatalogNavbar';
import Footer        from '@/components/catalog/Footer';
import { ProductCard, Product } from '@/components/catalog/ProductCard';
import { ProductCardSkeleton }  from '@/components/ui/Skeletons';
import api from '@/lib/api';

const fetcher = (url: string) => api.get(url).then(r => r.data);

interface FilterState {
  area: string; brand: string; sort: string;
  priceMin: string; priceMax: string; inStock: boolean;
}

function CatalogContent() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterState>({
    area: searchParams.get('area') ?? '',
    brand: '', sort: '-created_at',
    priceMin: '', priceMax: '', inStock: false,
  });
  const [page,    setPage]    = useState(1);
  const [view,    setView]    = useState<'grid' | 'list'>('grid');
  const [sidebar, setSidebar] = useState(false);
  const query = searchParams.get('q') ?? '';

  const { data: areasData }  = useSWR('/api/v1/areas/menu/', fetcher);
  const { data: brandsData } = useSWR('/api/v1/brands/', fetcher);
  const areas  = Array.isArray(areasData)  ? areasData  : (areasData?.results  ?? []);
  const brands = Array.isArray(brandsData) ? brandsData : (brandsData?.results ?? []);

  // Build query string
  const qs = new URLSearchParams();
  if (query)           qs.set('search',   query);
  if (filters.area)    qs.set('area',     filters.area);
  if (filters.brand)   qs.set('brand',    filters.brand);
  if (filters.priceMin)qs.set('price_min',filters.priceMin);
  if (filters.priceMax)qs.set('price_max',filters.priceMax);
  if (filters.inStock) qs.set('in_stock', 'true');
  if (filters.sort)    qs.set('ordering', filters.sort);
  qs.set('page', String(page));
  qs.set('page_size', '24');

  const { data, isLoading } = useSWR<{ results: Product[]; count: number }>(`/api/v1/products/?${qs}`, fetcher);
  const products   = data?.results ?? [];
  const totalCount = data?.count   ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / 24));

  const setFilter = (k: keyof FilterState) => (v: any) => {
    setFilters(p => ({ ...p, [k]: v }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters({ area: '', brand: '', sort: '-created_at', priceMin: '', priceMax: '', inStock: false });
    setPage(1);
  };

  const hasFilters = filters.area || filters.brand || filters.priceMin || filters.priceMax || filters.inStock;

  const FiltersPanel = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Areas */}
      <div>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Área</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[{ id: '', name: 'Todas las áreas' }, ...areas].map((a: any) => (
            <button key={a.id || 'all'} onClick={() => { setFilter('area')(a.slug ?? ''); setSidebar(false); }}
              style={{ padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem', fontWeight: filters.area === (a.slug ?? '') ? 600 : 400, background: filters.area === (a.slug ?? '') ? 'rgba(99,102,241,0.15)' : 'transparent', color: filters.area === (a.slug ?? '') ? 'var(--primary-light)' : 'var(--text-secondary)', transition: 'all 0.1s' }}>
              {a.name}
            </button>
          ))}
        </div>
      </div>

      {/* Brands */}
      {brands.length > 0 && (
        <div>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Marca</p>
          <select value={filters.brand} onChange={e => { setFilter('brand')(e.target.value); }} className="input" style={{ fontSize: '0.85rem' }}>
            <option value="">Todas las marcas</option>
            {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {/* Price */}
      <div>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Precio</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="number" placeholder="Mín" value={filters.priceMin} onChange={e => setFilter('priceMin')(e.target.value)} className="input" style={{ fontSize: '0.82rem' }} />
          <input type="number" placeholder="Máx" value={filters.priceMax} onChange={e => setFilter('priceMax')(e.target.value)} className="input" style={{ fontSize: '0.82rem' }} />
        </div>
      </div>

      {/* In stock */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={filters.inStock} onChange={e => setFilter('inStock')(e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Solo con stock</span>
      </label>

      {hasFilters && (
        <button className="btn btn-ghost btn-sm" onClick={resetFilters} style={{ alignSelf: 'flex-start' }}>
          <X size={14} /> Limpiar filtros
        </button>
      )}
    </div>
  );

  return (
    <>
      <CatalogNavbar />
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {query ? `Resultados para "${query}"` : 'Catálogo'}
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 3 }}>
              {isLoading ? 'Cargando…' : `${totalCount} productos encontrados`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Sort */}
            <select value={filters.sort} onChange={e => { setFilter('sort')(e.target.value); }} className="input" style={{ width: 'auto', fontSize: '0.85rem', padding: '8px 12px' }}>
              <option value="-created_at">Más recientes</option>
              <option value="price">Precio: menor</option>
              <option value="-price">Precio: mayor</option>
            </select>
            {/* View toggle */}
            <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <button className={`btn btn-icon ${view === 'grid' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('grid')} style={{ borderRadius: 0 }}>
                <Grid2X2 size={16} />
              </button>
              <button className={`btn btn-icon ${view === 'list' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('list')} style={{ borderRadius: 0 }}>
                <List size={16} />
              </button>
            </div>
            {/* Mobile filter toggle */}
            <button className="btn btn-secondary btn-sm" onClick={() => setSidebar(p => !p)}>
              <SlidersHorizontal size={15} /> Filtros {hasFilters ? `(activos)` : ''}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 24 }}>
          <div style={{ display: 'flex', gap: 24 }}>
            {/* Filters sidebar desktop */}
            <div style={{ width: 220, flexShrink: 0, display: window?.innerWidth > 1024 ? 'block' : sidebar ? 'block' : 'none' }} className="filters-sidebar">
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, position: 'sticky', top: 80 }}>
                <FiltersPanel />
              </div>
            </div>

            {/* Products */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: view === 'grid' ? 'repeat(auto-fill, minmax(180px, 1fr))' : '1fr', gap: 16 }}>
                {isLoading
                  ? Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />)
                  : products.length === 0
                    ? (
                      <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '64px 0' }}>
                        <Search size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
                        <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Sin resultados</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 6 }}>
                          Prueba con otros filtros o términos de búsqueda
                        </p>
                        {hasFilters && <button className="btn btn-secondary btn-sm" onClick={resetFilters} style={{ marginTop: 16 }}>Limpiar filtros</button>}
                      </div>
                    )
                    : products.map(p => <ProductCard key={p.id} product={p} />)
                }
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 40 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Anterior</button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                    <button key={p} className={`btn btn-sm ${page === p ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage(p)} style={{ minWidth: 36 }}>{p}</button>
                  ))}
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Siguiente</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`@media (min-width: 1024px) { .filters-sidebar { display: block !important; } }`}</style>
    </>
  );
}

export default function CatalogPage() {
  return <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} />}><CatalogContent /></Suspense>;
}
