'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Loader2, PackageX, Wrench } from 'lucide-react';
import { repairsApi, type RepairTicket, type RepairStats, ApiError } from '@/lib/api';
import styles from './Tecnicos.module.css';

const STATUS_TABS: { value: string; label: string; key: keyof RepairStats }[] = [
  { value: '', label: 'Todos', key: 'total' },
  { value: 'received', label: 'Recibidos', key: 'received' },
  { value: 'diagnosis', label: 'Diagnóstico', key: 'diagnosis' },
  { value: 'in_progress', label: 'En reparación', key: 'in_progress' },
  { value: 'waiting_part', label: 'Esperando repuesto', key: 'waiting_part' },
  { value: 'ready', label: 'Listos', key: 'ready' },
  { value: 'delivered', label: 'Entregados', key: 'delivered' },
];

export default function TecnicosPanelPage() {
  const { data: session } = useSession();
  const token = (session as unknown as { accessToken?: string })?.accessToken;

  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [stats, setStats] = useState<RepairStats | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number, sf: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [ticketsData, statsData] = await Promise.all([
        repairsApi.list(token, p, sf || undefined),
        repairsApi.stats(token),
      ]);
      setTickets(ticketsData.results);
      setPages(ticketsData.pages);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los tickets.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(page, statusFilter); }, [page, statusFilter, load]);

  return (
    <div>
      <div className={styles.head}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Reparaciones</h1>
      </div>

      <div className={styles.tabs}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            className={`${styles.tab} ${statusFilter === tab.value ? styles.active : ''}`}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
          >
            {tab.label}
            {stats && <span className={styles.badge}>{stats[tab.key]}</span>}
          </button>
        ))}
      </div>

      {loading && <div className={styles.empty}><Loader2 size={24} className="spin" /></div>}
      {!loading && error && <div className={styles.empty}><PackageX size={28} /><p>{error}</p></div>}
      {!loading && !error && tickets.length === 0 && (
        <div className={styles.empty}><Wrench size={28} /><p>No hay tickets en este estado.</p></div>
      )}

      {!loading && !error && tickets.length > 0 && (
        <div className={styles.list}>
          {tickets.map((t) => (
            <Link key={t.id} href={`/panel/tecnicos/${t.id}`} className={styles.card}>
              <div className={styles.cardLeft}>
                <span className={styles.ticketNum}>{t.ticket_number}</span>
                <span className={styles.device}>{t.device_type} {t.device_brand} {t.device_model}</span>
                <span className={styles.customer}>{t.customer_name}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span className={`${styles.statusPill} ${styles[`st_${t.status}`] || ''}`}>{t.status_display}</span>
                <span className={styles.technicianTag}>{t.technician_name}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{page} / {pages}</span>
          <button className={styles.pageBtn} onClick={() => setPage((p) => p + 1)} disabled={page >= pages}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
