'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Plus, Tag, Loader2, PackageX, X } from 'lucide-react';
import { couponsApi, type CouponData, ApiError } from '@/lib/api';
import styles from './Cupones.module.css';

export default function CuponesPanelPage() {
  const { data: session } = useSession();
  const token = (session as unknown as { accessToken?: string })?.accessToken;

  const [coupons, setCoupons] = useState<CouponData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await couponsApi.list(token);
      setCoupons(data.results);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los cupones.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (coupon: CouponData) => {
    if (!token) return;
    const next = !coupon.is_active;
    setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? { ...c, is_active: next } : c)));
    try {
      await couponsApi.update(coupon.id, { is_active: next }, token);
    } catch {
      setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? { ...c, is_active: !next } : c)));
    }
  };

  return (
    <div>
      <div className={styles.head}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Cupones</h1>
        <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
          <Plus size={15} /> Nuevo cupón
        </button>
      </div>

      {loading && <div className={styles.empty}><Loader2 size={24} className="spin" /></div>}
      {!loading && error && <div className={styles.empty}><PackageX size={28} /><p>{error}</p></div>}
      {!loading && !error && coupons.length === 0 && (
        <div className={styles.empty}><Tag size={28} /><p>No hay cupones creados todavía.</p></div>
      )}

      {!loading && !error && coupons.length > 0 && (
        <div className={styles.list}>
          {coupons.map((c) => (
            <div key={c.id} className={styles.row}>
              <div>
                <div className={styles.code}>{c.code} · -{c.discount_pct}%</div>
                <div className={styles.meta}>
                  {c.used_count} usos{c.max_uses ? ` de ${c.max_uses}` : ' (sin límite)'}
                  {Number(c.min_purchase_amount) > 0 && ` · mín. $${Number(c.min_purchase_amount).toLocaleString('es-CO')}`}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`${styles.badge} ${c.is_active ? styles.badgeOn : styles.badgeOff}`}>
                  {c.is_active ? 'Activo' : 'Pausado'}
                </span>
                <button className={styles.toggleBtn} onClick={() => toggleActive(c)}>
                  {c.is_active ? 'Pausar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && token && (
        <CreateCouponModal token={token} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
      )}
    </div>
  );
}

function CreateCouponModal({ token, onClose, onCreated }: {
  token: string; onClose: () => void; onCreated: () => void;
}) {
  const [form, setForm] = useState({ code: '', discount_pct: '', max_uses: '', min_purchase_amount: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.discount_pct) return;
    setLoading(true);
    setError(null);
    try {
      await couponsApi.create({
        code: form.code.trim().toUpperCase(),
        discount_pct: form.discount_pct,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        min_purchase_amount: form.min_purchase_amount || '0',
      }, token);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el cupón.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Nuevo cupón</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className={styles.field}>
            <label htmlFor="code">Código</label>
            <input id="code" required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
          </div>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label htmlFor="discount">Descuento (%)</label>
              <input id="discount" type="number" min="1" max="100" required
                value={form.discount_pct} onChange={(e) => setForm((f) => ({ ...f, discount_pct: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label htmlFor="max_uses">Usos máximos (opcional)</label>
              <input id="max_uses" type="number" min="1"
                value={form.max_uses} onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))} />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="min_purchase">Compra mínima (opcional)</label>
            <input id="min_purchase" type="number" min="0"
              value={form.min_purchase_amount} onChange={(e) => setForm((f) => ({ ...f, min_purchase_amount: e.target.value }))} />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnGhost} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? <Loader2 size={14} className="spin" /> : 'Crear cupón'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
