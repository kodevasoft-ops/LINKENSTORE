'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft, Star, Heart, ShoppingBag, Minus, Plus, Loader2, PackageX, Check,
} from 'lucide-react';
import { catalogApi, reviewsApi, wishlistApi, type ProductDetail, type Product, type Review, ApiError } from '@/lib/api';
import { useCart } from '@/lib/cart-context';
import ProductCard from '@/components/product/ProductCard';
import styles from './ProductDetail.module.css';

const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = String(params.slug);
  const { data: session } = useSession();
  const token = (session as unknown as { accessToken?: string })?.accessToken;
  const { add } = useCart();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wished, setWished] = useState(false);
  const [added, setAdded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, r, rev] = await Promise.all([
        catalogApi.detail(slug),
        catalogApi.related(slug).catch(() => ({ results: [] })),
        reviewsApi.list(slug).catch(() => ({ results: [] })),
      ]);
      setProduct(p);
      setRelated(r.results);
      setReviews(rev.results);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el producto.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const handleAddToCart = () => {
    if (!product) return;
    for (let i = 0; i < qty; i++) add({ ...product, price: product.effective_price });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const handleWishlist = async () => {
    if (!token) {
      router.push('/');
      return;
    }
    setWished(true);
    try {
      await wishlistApi.add(slug, token);
    } catch {
      setWished(false);
    }
  };

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Loader2 size={26} className="spin" /></div>;
  if (error || !product) {
    return (
      <div style={{ padding: 80, textAlign: 'center', color: 'var(--muted)' }}>
        <PackageX size={30} style={{ margin: '0 auto 12px' }} />
        <p>{error || 'Producto no encontrado.'}</p>
      </div>
    );
  }

  const outOfStock = product.stock <= 0;
  const images = product.images.length > 0 ? product.images : [{ id: 'placeholder', url: '' }];

  return (
    <main className={styles.wrap4}>
      <button className={styles.back} onClick={() => router.push('/productos')}>
        <ArrowLeft size={15} /> Volver al catálogo
      </button>

      <div className={styles.grid}>
        <div className={styles.gallery}>
          <div className={styles.mainImage}>
            {images[activeImage]?.url && (
              <Image
                src={images[activeImage].url}
                alt={product.name}
                fill
                sizes="(max-width: 800px) 100vw, 500px"
                style={{ objectFit: 'cover' }}
                priority
              />
            )}
          </div>
          {images.length > 1 && (
            <div className={styles.thumbRow}>
              {images.map((img, i) => (
                <button
                  key={img.id}
                  className={`${styles.thumb} ${i === activeImage ? styles.active : ''}`}
                  onClick={() => setActiveImage(i)}
                >
                  {img.url && <Image src={img.url} alt="" fill sizes="120px" style={{ objectFit: 'cover' }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.info}>
          <span className={styles.puntoTag}>{product.punto_name}</span>
          <h1 className={styles.title}>{product.name}</h1>

          <div className={styles.metaRow}>
            <div className={styles.starsRow}>
              <Star size={14} fill="var(--y)" stroke="none" />
              <span>{product.rating.toFixed(1)} ({product.reviews_count} reseñas)</span>
            </div>
            <span className={styles.sku}>SKU: {product.sku || '—'}</span>
          </div>

          <div className={styles.priceRow}>
            <span className={styles.price}>{currency.format(Number(product.effective_price))}</span>
            {(product.on_promotion || product.compare_at) && (
              <>
                <span className={styles.oldPrice}>{currency.format(Number(product.compare_at || product.price))}</span>
                <span className={styles.discountBadge}>
                  -{Math.round((1 - Number(product.effective_price) / Number(product.compare_at || product.price)) * 100)}%
                </span>
              </>
            )}
          </div>

          <p className={`${styles.stockNote} ${outOfStock ? styles.stockOut : product.stock <= 3 ? styles.stockLow : styles.stockOk}`}>
            {outOfStock ? 'Agotado' : product.stock <= 3 ? `Últimas ${product.stock} unidades` : 'Disponible'}
          </p>

          {!outOfStock && (
            <div className={styles.qtyRow}>
              <div className={styles.qtyControl}>
                <button className={styles.qtyBtn} onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus size={14} /></button>
                <span className={styles.qtyN}>{qty}</span>
                <button className={styles.qtyBtn} onClick={() => setQty((q) => Math.min(product.stock, q + 1))}><Plus size={14} /></button>
              </div>
            </div>
          )}

          <button className={styles.addBtn} onClick={handleAddToCart} disabled={outOfStock}>
            {added ? <Check size={17} /> : <ShoppingBag size={17} />}
            {outOfStock ? 'Agotado' : added ? 'Agregado' : 'Agregar al carrito'}
          </button>
          <button className={styles.wishBtn} onClick={handleWishlist} disabled={wished}>
            <Heart size={16} fill={wished ? 'currentColor' : 'none'} />
            {wished ? 'En favoritos' : 'Añadir a favoritos'}
          </button>

          {product.description && <p className={styles.description}>{product.description}</p>}
        </div>
      </div>

      {product.specs && Object.keys(product.specs).length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Especificaciones</h2>
          <div className={styles.specsGrid}>
            {Object.entries(product.specs).map(([key, value]) => (
              <div key={key} className={styles.specItem}>
                <strong>{key.replace(/_/g, ' ')}</strong>
                {String(value)}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Reseñas</h2>
        <ReviewForm slug={slug} token={token} onSubmitted={load} />
        {reviews.length === 0 && <p className={styles.emptyReviews}>Todavía no hay reseñas para este producto.</p>}
        {reviews.map((r) => (
          <div key={r.id} className={styles.reviewItem}>
            <div className={styles.reviewHead}>
              <span className={styles.reviewUser}>{r.user_name || 'Cliente'}</span>
              <span className={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString('es-CO')}</span>
            </div>
            <div className={styles.starsRow} style={{ marginBottom: 6 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={13} fill={i < r.rating ? 'var(--y)' : 'none'} stroke={i < r.rating ? 'none' : 'var(--muted)'} />
              ))}
            </div>
            {r.comment && <p className={styles.reviewComment}>{r.comment}</p>}
          </div>
        ))}
      </section>

      {related.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>También te puede interesar</h2>
          <div className={styles.relatedGrid}>
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </main>
  );
}

function ReviewForm({ slug, token, onSubmitted }: { slug: string; token?: string; onSubmitted: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) return null;

  const submit = async () => {
    if (rating === 0) {
      setError('Selecciona una calificación.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await reviewsApi.create(slug, { rating, comment }, token);
      setRating(0);
      setComment('');
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar tu reseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.reviewForm}>
      <div className={styles.starPicker}>
        {Array.from({ length: 5 }).map((_, i) => (
          <button key={i} className={`${styles.starBtn} ${i < rating ? styles.filled : ''}`} onClick={() => setRating(i + 1)}>
            <Star size={22} fill={i < rating ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      <textarea
        rows={3} placeholder="Cuéntanos qué te pareció (opcional)"
        value={comment} onChange={(e) => setComment(e.target.value)}
      />
      {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{error}</p>}
      <button className={styles.submitReviewBtn} onClick={submit} disabled={loading}>
        {loading ? <Loader2 size={14} className="spin" /> : 'Enviar reseña'}
      </button>
    </div>
  );
}
