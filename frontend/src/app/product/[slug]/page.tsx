'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import useSWR from 'swr';
import { ShoppingCart, Heart, Star, Minus, Plus, Package, ChevronLeft, Truck, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import CatalogNavbar from '@/components/catalog/CatalogNavbar';
import Footer        from '@/components/catalog/Footer';
import { ProductCard, Product } from '@/components/catalog/ProductCard';
import { ProductDetailSkeleton, ProductCardSkeleton } from '@/components/ui/Skeletons';
import { useCartStore } from '@/store';
import { useAnalytics } from '@/hooks/useAnalytics';
import api from '@/lib/api';

interface ProductDetail extends Product {
  description?: string;
  specs?:       Record<string, string>;
  images?:      string[];
  sku?:         string;
}
interface Review { id: string; user_name: string; rating: number; comment: string; created_at: string }

const fetcher = (url: string) => api.get(url).then(r => r.data);

function StarRow({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={14}
          fill={i <= Math.round(rating) ? 'var(--warning)' : 'none'}
          color={i <= Math.round(rating) ? 'var(--warning)' : 'var(--text-muted)'} />
      ))}
    </div>
  );
}

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { addItem }   = useCartStore();
  const { trackCart } = useAnalytics();

  const [qty,    setQty]    = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [tab,    setTab]    = useState<'desc'|'specs'|'reviews'>('desc');
  const [wished, setWished] = useState(false);

  const { data: product, isLoading } = useSWR<ProductDetail>(`/api/v1/products/${slug}/`, fetcher);
  const { data: reviewsData } = useSWR<{ results: Review[] }>(product ? `/api/v1/products/${product.id}/reviews/` : null, fetcher);
  const { data: relatedData } = useSWR<{ results: Product[] }>(product ? `/api/v1/products/${product.id}/related/` : null, fetcher);

  const reviews = reviewsData?.results ?? [];
  const related = relatedData?.results ?? [];
  const images  = (product?.images?.length ? product.images : product?.image ? [product.image] : []) as string[];

  const pct = (product?.compare_at && product.compare_at > product.price)
    ? Math.round((1 - product.price / product.compare_at) * 100) : 0;

  const handleAddToCart = () => {
    if (!product) return;
    addItem({ id: product.id, name: product.name, price: product.price, image: product.image, qty });
    trackCart('add_item', { itemsCount: qty, cartTotal: product.price * qty, areaName: product.area_name });
    toast.success(`${qty}x ${product.name} añadido al carrito`);
  };

  return (
    <>
      <CatalogNavbar />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <Link href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Inicio</Link>
          <span>/</span>
          <Link href="/catalog" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Catálogo</Link>
          {product && <><span>/</span><span style={{ color: 'var(--text-secondary)' }}>{product.name}</span></>}
        </div>

        {isLoading || !product ? (
          <ProductDetailSkeleton />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 40 }}>
              {/* Gallery */}
              <div>
                <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)', aspectRatio: '1' }}>
                  {images[imgIdx]
                    ? <Image src={images[imgIdx]} alt={product.name} fill style={{ objectFit: 'cover' }} />
                    : <div style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center' }}><Package size={64} color="var(--text-muted)" /></div>
                  }
                  {pct > 0 && (
                    <span style={{ position:'absolute',top:14,left:14,background:'var(--danger)',color:'#fff',fontSize:'0.75rem',fontWeight:700,padding:'4px 10px',borderRadius:99 }}>
                      -{pct}%
                    </span>
                  )}
                  <button onClick={() => setWished(p=>!p)}
                    style={{ position:'absolute',top:14,right:14,width:36,height:36,borderRadius:'50%',background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                    <Heart size={18} fill={wished ? '#ef4444':'none'} color={wished ? '#ef4444':'#fff'} />
                  </button>
                </div>
                {images.length > 1 && (
                  <div style={{ display:'flex',gap:8,marginTop:12,flexWrap:'wrap' }}>
                    {images.map((img,i) => (
                      <button key={i} onClick={() => setImgIdx(i)}
                        style={{ width:64,height:64,borderRadius:8,overflow:'hidden',border:`2px solid ${imgIdx===i?'var(--primary)':'var(--border)'}`,background:'var(--bg-card)',cursor:'pointer',padding:0,transition:'border-color 0.15s' }}>
                        <img src={img} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ display:'flex',flexDirection:'column',gap:20 }}>
                {product.brand_name && <p style={{ fontSize:'0.75rem',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:700 }}>{product.brand_name}</p>}
                <h1 style={{ fontSize:'1.5rem',fontWeight:800,color:'var(--text-primary)',lineHeight:1.25,letterSpacing:'-0.02em' }}>{product.name}</h1>

                {product.rating !== undefined && product.rating > 0 && (
                  <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                    <StarRow rating={product.rating} />
                    <span style={{ fontSize:'0.85rem',color:'var(--text-secondary)',fontWeight:600 }}>{product.rating.toFixed(1)}</span>
                    <span style={{ fontSize:'0.78rem',color:'var(--text-muted)' }}>({reviews.length} reseñas)</span>
                  </div>
                )}

                {/* Price */}
                <div style={{ display:'flex',alignItems:'baseline',gap:12 }}>
                  <span style={{ fontSize:'2rem',fontWeight:800,color:'var(--text-primary)',fontVariantNumeric:'tabular-nums' }}>
                    ${Number(product.price).toLocaleString('es-CO')}
                  </span>
                  {pct > 0 && (
                    <span style={{ fontSize:'1.1rem',color:'var(--text-muted)',textDecoration:'line-through',fontVariantNumeric:'tabular-nums' }}>
                      ${Number(product.compare_at).toLocaleString('es-CO')}
                    </span>
                  )}
                </div>

                {/* Stock */}
                <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                  <div style={{ width:8,height:8,borderRadius:'50%',background: product.stock > 5 ? 'var(--success)' : product.stock > 0 ? 'var(--warning)' : 'var(--danger)' }} />
                  <span style={{ fontSize:'0.85rem',color: product.stock > 5 ? 'var(--success)' : product.stock > 0 ? 'var(--warning)' : 'var(--danger)', fontWeight:600 }}>
                    {product.stock > 5 ? 'En stock' : product.stock > 0 ? `Solo ${product.stock} disponibles` : 'Sin stock'}
                  </span>
                  {product.sku && <span style={{ fontSize:'0.75rem',color:'var(--text-muted)',marginLeft:8 }}>SKU: {product.sku}</span>}
                </div>

                {/* Qty + CTA */}
                {product.stock > 0 && (
                  <div style={{ display:'flex',gap:12,alignItems:'center',flexWrap:'wrap' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:0,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden' }}>
                      <button onClick={() => setQty(p=>Math.max(1,p-1))} className="btn btn-ghost" style={{ borderRadius:0,padding:'10px 14px' }}><Minus size={16} /></button>
                      <span style={{ padding:'10px 20px',fontSize:'1rem',fontWeight:700,color:'var(--text-primary)',fontVariantNumeric:'tabular-nums' }}>{qty}</span>
                      <button onClick={() => setQty(p=>Math.min(product.stock,p+1))} className="btn btn-ghost" style={{ borderRadius:0,padding:'10px 14px' }}><Plus size={16} /></button>
                    </div>
                    <button className="btn btn-primary" onClick={handleAddToCart} style={{ flex:1,minWidth:180,gap:8 }}>
                      <ShoppingCart size={18} /> Añadir al carrito
                    </button>
                  </div>
                )}

                {/* Trust */}
                <div style={{ display:'flex',flexDirection:'column',gap:10,padding:'16px',background:'var(--bg-card)',borderRadius:12,border:'1px solid var(--border)' }}>
                  {[
                    { icon: <Truck size={16} />,  label: 'Envío rápido a todo el país' },
                    { icon: <Shield size={16} />, label: 'Garantía y soporte incluidos' },
                  ].map(t => (
                    <div key={t.label} style={{ display:'flex',alignItems:'center',gap:10 }}>
                      <span style={{ color:'var(--primary)',flexShrink:0 }}>{t.icon}</span>
                      <span style={{ fontSize:'0.82rem',color:'var(--text-secondary)' }}>{t.label}</span>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div>
                  <div style={{ display:'flex',borderBottom:'1px solid var(--border)',gap:0,marginBottom:16 }}>
                    {(['desc','specs','reviews'] as const).map(t => (
                      <button key={t} onClick={() => setTab(t)}
                        style={{ padding:'10px 16px',fontSize:'0.875rem',fontWeight:tab===t?700:500,color:tab===t?'var(--primary)':'var(--text-muted)',background:'none',border:'none',borderBottom:`2px solid ${tab===t?'var(--primary)':'transparent'}`,cursor:'pointer',transition:'all 0.15s' }}>
                        {t==='desc'?'Descripción':t==='specs'?'Especificaciones':`Reseñas (${reviews.length})`}
                      </button>
                    ))}
                  </div>

                  {tab === 'desc' && (
                    <p style={{ fontSize:'0.875rem',color:'var(--text-secondary)',lineHeight:1.7 }}>
                      {product.description || 'Sin descripción disponible para este producto.'}
                    </p>
                  )}
                  {tab === 'specs' && (
                    <div>
                      {product.specs && Object.keys(product.specs).length > 0
                        ? Object.entries(product.specs).map(([k,v]) => (
                          <div key={k} style={{ display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--border)',fontSize:'0.875rem' }}>
                            <span style={{ color:'var(--text-muted)' }}>{k}</span>
                            <span style={{ color:'var(--text-primary)',fontWeight:500 }}>{v}</span>
                          </div>
                        ))
                        : <p style={{ fontSize:'0.85rem',color:'var(--text-muted)' }}>Sin especificaciones técnicas.</p>
                      }
                    </div>
                  )}
                  {tab === 'reviews' && (
                    <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
                      {reviews.length === 0
                        ? <p style={{ fontSize:'0.85rem',color:'var(--text-muted)' }}>Sin reseñas aún.</p>
                        : reviews.map(r => (
                          <div key={r.id} style={{ padding:'14px 0',borderBottom:'1px solid var(--border)' }}>
                            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6 }}>
                              <span style={{ fontSize:'0.875rem',fontWeight:600,color:'var(--text-primary)' }}>{r.user_name}</span>
                              <StarRow rating={r.rating} />
                            </div>
                            {r.comment && <p style={{ fontSize:'0.85rem',color:'var(--text-secondary)',lineHeight:1.6 }}>{r.comment}</p>}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Related */}
            {related.length > 0 && (
              <section style={{ marginTop:56 }}>
                <h2 style={{ fontSize:'1.1rem',fontWeight:700,color:'var(--text-primary)',marginBottom:20 }}>Productos relacionados</h2>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:16 }}>
                  {related.map(p => <ProductCard key={p.id} product={p} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
