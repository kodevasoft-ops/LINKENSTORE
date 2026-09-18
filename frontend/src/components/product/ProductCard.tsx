'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star, Heart, Eye, ShoppingBag } from 'lucide-react';
import type { Product } from '@/lib/api';
import { useCart } from '@/lib/cart-context';
import styles from './ProductCard.module.css';

const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const [wished, setWished] = useState(false);
  const outOfStock = product.stock <= 0;

  return (
    <article className={styles.card}>
      <Link href={`/productos/${product.slug}`} className={styles.imgWrap}>
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div aria-hidden="true" />
        )}
        <div className={styles.actions}>
          <button
            className={`${styles.actionBtn} ${wished ? styles.active : ''}`}
            onClick={(e) => { e.preventDefault(); setWished((w) => !w); }}
            aria-label={wished ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            aria-pressed={wished}
          >
            <Heart size={16} fill={wished ? 'currentColor' : 'none'} />
          </button>
          <span className={styles.actionBtn} aria-hidden="true">
            <Eye size={16} />
          </span>
        </div>
      </Link>

      <div className={styles.body}>
        <span className={styles.cat}>{product.area_name}</span>
        <Link href={`/productos/${product.slug}`}>
          <h3 className={styles.name}>{product.name}</h3>
        </Link>

        <div className={styles.starsRow}>
          <Star size={13} fill="var(--y)" stroke="none" />
          <span>{product.rating.toFixed(1)}</span>
          <span>({product.reviews_count})</span>
        </div>

        <div className={styles.priceRow}>
          <span className={styles.price}>{currency.format(Number(product.effective_price))}</span>
          {(product.on_promotion || product.compare_at) && (
            <span className={styles.oldPrice}>{currency.format(Number(product.compare_at || product.price))}</span>
          )}
        </div>

        <button
          className={styles.addBtn}
          onClick={() => add({ ...product, price: product.effective_price })}
          disabled={outOfStock}
        >
          <ShoppingBag size={15} />
          {outOfStock ? 'Agotado' : 'Agregar al carrito'}
        </button>
      </div>
    </article>
  );
}
