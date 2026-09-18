'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  User, ShoppingBag, Wrench, Save, Loader2, ChevronLeft, ChevronRight, Truck, PackageX,
} from 'lucide-react';
import { authApi, checkoutApi, repairsApi, type CustomerProfile, ApiError } from '@/lib/api';
import styles from './Cuenta.module.css';

const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

type Tab = 'perfil' | 'compras' | 'reparaciones';

export default function CuentaPage() {
  const { data: session, status } = useSession();
  const token = (session as unknown as { accessToken?: string })?.accessToken;
  const [tab, setTab] = useState<Tab>('perfil');

  if (status === 'loading') {
    return <div className={styles.wrap3}><Loader2 size={24} className="spin" /></div>;
  }
  if (status !== 'authenticated' || !token) {
    return (
      <div className={styles.wrap3} style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--muted)' }}>Inicia sesión para ver tu cuenta.</p>
      </div>
    );
  }

  return (
    <main className={styles.wrap3}>
      <h1 className={styles.title}>Mi cuenta</h1>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'perfil' ? styles.on : ''}`} onClick={() => setTab('perfil')}>
          <User size={14} style={{ verticalAlign: -2, marginRight: 6 }} /> Perfil
        </button>
        <button className={`${styles.tab} ${tab === 'compras' ? styles.on : ''}`} onClick={() => setTab('compras')}>
          <ShoppingBag size={14} style={{ verticalAlign: -2, marginRight: 6 }} /> Mis compras
        </button>
        <button className={`${styles.tab} ${tab === 'reparaciones' ? styles.on : ''}`} onClick={() => setTab('reparaciones')}>
          <Wrench size={14} style={{ verticalAlign: -2, marginRight: 6 }} /> Reparaciones
        </button>
      </div>

      {tab === 'perfil' && <ProfileTab token={token} />}
      {tab === 'compras' && <PurchasesTab token={token} />}
      {tab === 'reparaciones' && <RepairsTab token={token} />}
    </main>
  );
}

function ProfileTab({ token }: { token: string }) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authApi.me(token)
      .then(setProfile)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu perfil.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await authApi.updateMe(
        { first_name: profile.first_name, last_name: profile.last_name, phone: profile.phone },
        token
      );
      setProfile(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.section}><Loader2 size={20} className="spin" /></div>;
  if (!profile) return <div className={styles.section}><p style={{ color: 'var(--muted)' }}>{error}</p></div>;

  return (
    <div className={styles.section}>
      <div className={styles.field}>
        <label>Correo electrónico</label>
        <input value={profile.email} disabled />
      </div>
      <div className={styles.row2}>
        <div className={styles.field}>
          <label htmlFor="fname">Nombre</label>
          <input id="fname" value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} />
        </div>
        <div className={styles.field}>
          <label htmlFor="lname">Apellido</label>
          <input id="lname" value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} />
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="phone">Teléfono</label>
        <input id="phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
      </div>
      {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</p>}
      <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Guardar cambios
      </button>
    </div>
  );
}

function PurchasesTab({ token }: { token: string }) {
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [purchases, setPurchases] = useState<Awaited<ReturnType<typeof checkoutApi.myPurchases>>['results']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await checkoutApi.myPurchases(token, p);
      setPurchases(data.results);
      setPages(data.pages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus compras.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(page); }, [page, load]);

  if (loading) return <div className={styles.section}><Loader2 size={20} className="spin" /></div>;

  return (
    <div className={styles.section}>
      {error && <p style={{ color: '#ef4444', fontSize: 12 }}>{error}</p>}
      {!error && purchases.length === 0 && (
        <div className={styles.empty}><PackageX size={26} /><p>Todavía no tienes compras.</p></div>
      )}
      {purchases.map((p) => (
        <div key={p.id} className={styles.purchaseCard}>
          <div className={styles.purchaseHead}>
            <span className={styles.purchaseNum}>{p.session_number}</span>
            <span className={styles.statusPill}>{p.status_display}</span>
          </div>
          <div className={styles.purchaseDate}>{new Date(p.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
          <div className={styles.ordersList}>
            {p.orders.map((o) => `${o.punto_name}: ${o.items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ')}`).join(' · ')}
          </div>
          {p.envio && (
            <div className={styles.envioTag}>
              <Truck size={12} /> Guía {p.envio.guide_number} — {p.envio.status_display}
            </div>
          )}
          <div className={styles.purchaseTotal}>{currency.format(Number(p.total))}</div>
        </div>
      ))}
      {pages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} onClick={() => setPage((p) => p - 1)} disabled={page <= 1}><ChevronLeft size={15} /></button>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{page} / {pages}</span>
          <button className={styles.pageBtn} onClick={() => setPage((p) => p + 1)} disabled={page >= pages}><ChevronRight size={15} /></button>
        </div>
      )}
    </div>
  );
}

function RepairsTab({ token }: { token: string }) {
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [tickets, setTickets] = useState<Awaited<ReturnType<typeof repairsApi.list>>['results']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await repairsApi.list(token, p);
      setTickets(data.results);
      setPages(data.pages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus reparaciones.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(page); }, [page, load]);

  if (loading) return <div className={styles.section}><Loader2 size={20} className="spin" /></div>;

  return (
    <div className={styles.section}>
      {error && <p style={{ color: '#ef4444', fontSize: 12 }}>{error}</p>}
      {!error && tickets.length === 0 && (
        <div className={styles.empty}><Wrench size={26} /><p>No tienes reparaciones registradas.</p></div>
      )}
      {tickets.map((t) => (
        <div key={t.id} className={styles.purchaseCard}>
          <div className={styles.purchaseHead}>
            <span className={styles.purchaseNum}>{t.ticket_number}</span>
            <span className={styles.statusPill}>{t.status_display}</span>
          </div>
          <div className={styles.purchaseDate}>{t.device_type} {t.device_brand} {t.device_model}</div>
        </div>
      ))}
      {pages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} onClick={() => setPage((p) => p - 1)} disabled={page <= 1}><ChevronLeft size={15} /></button>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{page} / {pages}</span>
          <button className={styles.pageBtn} onClick={() => setPage((p) => p + 1)} disabled={page >= pages}><ChevronRight size={15} /></button>
        </div>
      )}
    </div>
  );
}
