'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Loader2, PackageX } from 'lucide-react';
import { catalogApi, type Product, ApiError } from '@/lib/api';
import ProductCard from '@/components/product/ProductCard';
import TrackShipment from '@/components/shipping/TrackShipment';
import styles from './HomePage.module.css';

export default function HomePage() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    catalogApi
      .featured(8)
      .then((data) => setFeatured(data.results))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el catálogo.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main>
      <section className="wrap">
        <div className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Smartphones · Repuestos · Hogar</p>
            <h1 className={styles.heroTitle}>
              Todo tu <em>ecosistema tech</em>, en un solo lugar
            </h1>
            <p className={styles.heroText}>
              Compra equipos y repuestos originales, y lleva tu reparación con seguimiento
              en tiempo real desde el mismo sitio.
            </p>
            <div className={styles.heroActions}>
              <Link href="/productos" className={styles.ctaPrimary}>
                Ver catálogo <ArrowRight size={16} />
              </Link>
              <Link href="/reparaciones" className={styles.ctaSecondary}>
                Rastrear una reparación
              </Link>
            </div>
          </div>
          <div>
            <div className={styles.heroVisual} aria-hidden="true">
              <ShieldCheck size={48} strokeWidth={1.2} />
            </div>
            <TrackShipment />
          </div>
        </div>
      </section>

      <section className={`wrap ${styles.section}`}>
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.sectionLabel}>Seleccionados para ti</p>
            <h2 className={styles.sectionTitle}>Productos destacados</h2>
          </div>
          <Link href="/productos" className={styles.seeAll}>
            Ver todos <ArrowRight size={14} />
          </Link>
        </div>

        {loading && (
          <div className={styles.state}>
            <Loader2 size={24} className="spin" />
          </div>
        )}

        {!loading && error && (
          <div className={styles.state}>
            <PackageX size={28} />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className={styles.grid}>
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
