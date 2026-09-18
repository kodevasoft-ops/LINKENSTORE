'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Truck, ChevronLeft, ChevronRight, Loader2, PackageX } from 'lucide-react';
import { enviosApi, type EnvioListItem, ApiError } from '@/lib/api';
import styles from './Envios.module.css';

export default function EnviosPanelPage() {
  const { data: session } = useSession();
  const token = (session as unknown as { accessToken?: string })?.accessToken;

  const [envios, setEnvios] = useState<EnvioListItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await enviosApi.list(token, p);
      setEnvios(data.results);
      setPages(data.pages);
      setCount(data.count);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los envíos.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(page); }, [page, load]);

  return (
    <div>
      <div className={styles.head}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Envíos</h1>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{count} guías registradas</span>
      </div>

      {loading && <div className={styles.empty}><Loader2 size={24} className="spin" /></div>}
      {!loading && error && <div className={styles.empty}><PackageX size={28} /><p>{error}</p></div>}
      {!loading && !error && envios.length === 0 && (
        <div className={styles.empty}>
          <Truck size={28} />
          <p>Todavía no se han registrado envíos. Se crean desde una venta pendiente en el panel de Ventas.</p>
        </div>
      )}

      {!loading && !error && envios.length > 0 && (
        <div className={styles.list}>
          {envios.map((e) => (
            <div key={e.id} className={styles.card}>
              <div>
                <div className={styles.guide}>{e.guide_number}</div>
                <div className={styles.city}>{e.carrier} {e.destination_city ? `· ${e.destination_city}` : ''}</div>
              </div>
              <span className={`${styles.statusPill} ${styles[`st_${e.status}`] || ''}`}>{e.status_display}</span>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} onClick={() => setPage((p) => p - 1)} disabled={page <= 1}><ChevronLeft size={16} /></button>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{page} / {pages}</span>
          <button className={styles.pageBtn} onClick={() => setPage((p) => p + 1)} disabled={page >= pages}><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  );
}
