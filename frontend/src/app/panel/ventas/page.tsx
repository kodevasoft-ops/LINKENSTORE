'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { ChevronLeft, ChevronRight, FileCheck2, Truck, Loader2, PackageX, X } from 'lucide-react';
import { salesApi, type SalesOrder, ApiError } from '@/lib/api';
import styles from './Ventas.module.css';

const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export default function VentasPendientesPage() {
  const { data: session } = useSession();
  const token = (session as unknown as { accessToken?: string })?.accessToken;

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tnsModalOrder, setTnsModalOrder] = useState<SalesOrder | null>(null);
  const [envioModalOrder, setEnvioModalOrder] = useState<SalesOrder | null>(null);

  const load = useCallback(async (p: number) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await salesApi.ventasPendientes(token, p);
      setOrders(data.results);
      setCount(data.count);
      setPages(data.pages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las ventas pendientes.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(page); }, [page, load]);

  const handleConfirmed = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    setCount((c) => Math.max(0, c - 1));
  };

  return (
    <div>
      <div className={styles.head}>
        <h1 className="pageTitle" style={{ fontSize: 22, fontWeight: 800 }}>Ventas pendientes</h1>
        <span className={styles.count}>{count} venta{count !== 1 ? 's' : ''} por facturar en TNS</span>
      </div>

      {loading && (
        <div className={styles.empty}><Loader2 size={24} className="spin" /></div>
      )}

      {!loading && error && (
        <div className={styles.empty}><PackageX size={28} /><p>{error}</p></div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className={styles.empty}><PackageX size={28} /><p>No hay ventas pendientes por facturar. ¡Al día!</p></div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className={styles.list}>
          {orders.map((order) => (
            <div key={order.id} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.orderNum}>{order.order_number}</span>
                <span className={styles.puntoTag}>{order.punto_name}</span>
              </div>
              <div className={styles.customerName}>{order.customer_name}</div>
              <div className={styles.itemsList}>
                {order.items.map((item) => (
                  <div key={item.id}>{item.quantity}x {item.product_name}</div>
                ))}
              </div>
              <div className={styles.cardFoot}>
                <span className={styles.total}>{currency.format(Number(order.total))}</span>
                <div className={styles.actions}>
                  {order.requires_shipping && (
                    <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setEnvioModalOrder(order)}>
                      <Truck size={14} /> Envío
                    </button>
                  )}
                  <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setTnsModalOrder(order)}>
                    <FileCheck2 size={14} /> Confirmar en TNS
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--muted)' }}>
            {page} / {pages}
          </span>
          <button className={styles.pageBtn} onClick={() => setPage((p) => p + 1)} disabled={page >= pages}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {tnsModalOrder && token && (
        <ConfirmTnsModal
          order={tnsModalOrder}
          token={token}
          onClose={() => setTnsModalOrder(null)}
          onConfirmed={() => { handleConfirmed(tnsModalOrder.id); setTnsModalOrder(null); }}
        />
      )}
      {envioModalOrder && token && (
        <CrearEnvioModal
          order={envioModalOrder}
          token={token}
          onClose={() => setEnvioModalOrder(null)}
        />
      )}
    </div>
  );
}

function ConfirmTnsModal({ order, token, onClose, onConfirmed }: {
  order: SalesOrder; token: string; onClose: () => void; onConfirmed: () => void;
}) {
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reference.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await salesApi.confirmTns(order.id, reference.trim(), token);
      onConfirmed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo confirmar la venta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>Confirmar factura TNS — {order.order_number}</h3>
        <input
          placeholder="Número o referencia de la factura en TNS"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          autoFocus
        />
        {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</p>}
        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={onClose}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={submit} disabled={loading || !reference.trim()}>
            {loading ? <Loader2 size={14} className="spin" /> : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CrearEnvioModal({ order, token, onClose }: {
  order: SalesOrder; token: string; onClose: () => void;
}) {
  const [guide, setGuide] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!guide.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await salesApi.crearEnvio(
        { checkout_session_id: order.checkout_session, guide_number: guide.trim(), destination_city: city.trim() },
        token
      );
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la guía.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Registrar envío — {order.order_number}</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        {done ? (
          <p style={{ color: 'var(--y)', fontSize: 13, marginBottom: 10 }}>Guía registrada correctamente.</p>
        ) : (
          <>
            <input placeholder="Número de guía Interrápidísimo" value={guide} onChange={(e) => setGuide(e.target.value)} autoFocus />
            <input placeholder="Ciudad de destino (opcional)" value={city} onChange={(e) => setCity(e.target.value)} />
            {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</p>}
          </>
        )}
        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={onClose}>{done ? 'Cerrar' : 'Cancelar'}</button>
          {!done && (
            <button className={styles.btnPrimary} onClick={submit} disabled={loading || !guide.trim()}>
              {loading ? <Loader2 size={14} className="spin" /> : 'Guardar guía'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
