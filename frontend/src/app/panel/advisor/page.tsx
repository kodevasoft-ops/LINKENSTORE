'use client';
import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { CheckCircle2, ChevronDown, ChevronUp, Package, MapPin, Hash, RefreshCw, ClipboardCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import PanelLayout from '@/components/layout/PanelLayout';
import { TableRowSkeleton } from '@/components/ui/Skeletons';
import api from '@/lib/api';

interface OrderItem { id: string; product_name: string; unit_price: number; quantity: number; subtotal: number }
interface Order {
  id: string; order_number: string; status: string; status_display: string;
  customer_name: string; shipping_name: string; shipping_phone: string;
  shipping_address: string; shipping_city: string; shipping_notes: string;
  subtotal: number; discount_amount: number; coupon_code: string; total: number;
  tns_confirmed: boolean; tns_confirmation_ref: string;
  items: OrderItem[]; created_at: string;
}

const fetcher = (url: string) => api.get(url).then(r => r.data);

const STATUS: Record<string, { color: string; bg: string }> = {
  paid:      { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
  confirmed: { color: '#818cf8', bg: 'rgba(129,140,248,0.1)' },
  shipped:   { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)' },
  delivered: { color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  cancelled: { color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
};

function OrderRow({ order, onRefresh }: { order: Order; onRefresh: () => void }) {
  const [open,       setOpen]       = useState(false);
  const [tnsRef,     setTnsRef]     = useState('');
  const [confirming, setConfirming] = useState(false);
  const [advancing,  setAdvancing]  = useState(false);

  const s = STATUS[order.status] ?? STATUS.paid;

  const confirmTns = async () => {
    if (!tnsRef.trim()) { toast.error('Ingresa la referencia TNS'); return; }
    setConfirming(true);
    try {
      await api.post(`/api/v1/orders/${order.id}/confirm-tns/`, { reference: tnsRef.trim() });
      toast.success(`Orden ${order.order_number} confirmada en TNS`);
      onRefresh(); setOpen(false);
    } catch { toast.error('Error al confirmar'); }
    finally { setConfirming(false); }
  };

  const advanceStatus = async (newStatus: string) => {
    setAdvancing(true);
    try {
      await api.patch(`/api/v1/orders/${order.id}/status/`, { status: newStatus });
      toast.success('Estado actualizado');
      onRefresh();
    } catch { toast.error('Error al actualizar estado'); }
    finally { setAdvancing(false); }
  };

  return (
    <div className="glass-card" style={{ overflow: 'hidden' }}>
      <button onClick={() => setOpen(p => !p)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        {/* Order number */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 }}>
          <Hash size={14} color="var(--primary)" />
          <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary)' }}>{order.order_number}</span>
        </div>
        {/* Customer */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', truncate: true }}>{order.shipping_name || order.customer_name}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{order.shipping_phone}</p>
        </div>
        {/* Items count */}
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', minWidth: 80, display: 'none' }} className="hide-sm">
          {order.items.length} prod.
        </span>
        {/* Total */}
        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', minWidth: 100, textAlign: 'right' }}>
          ${Number(order.total).toLocaleString('es-CO')}
        </span>
        {/* Status badge */}
        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 99, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
          {order.status_display}
        </span>
        {/* TNS badge */}
        {order.tns_confirmed && (
          <CheckCircle2 size={16} color="var(--success)" title="Confirmado en TNS" />
        )}
        {open ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {/* Shipping */}
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <MapPin size={12} /> Dirección de envío
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{order.shipping_address}</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{order.shipping_city}</p>
              {order.shipping_notes && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4 }}>"{order.shipping_notes}"</p>}
            </div>
            {/* Products */}
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Package size={12} /> Productos
              </p>
              {order.items.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{item.quantity}x {item.product_name}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${Number(item.subtotal).toLocaleString('es-CO')}</span>
                </div>
              ))}
              {order.discount_amount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--success)', marginTop: 4 }}>
                  <span>Descuento ({order.coupon_code})</span>
                  <span>-${Number(order.discount_amount).toLocaleString('es-CO')}</span>
                </div>
              )}
            </div>
          </div>

          {/* TNS confirmation */}
          {order.status === 'paid' && !order.tns_confirmed && (
            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '14px 16px' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--warning)', marginBottom: 6 }}>Pendiente de confirmar en TNS</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                Registra esta orden en el sistema TNS y pega la referencia generada.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <input type="text" value={tnsRef} onChange={e => setTnsRef(e.target.value)}
                  placeholder="Referencia TNS (ej: FAC-2024-00123)"
                  className="input" style={{ flex: 1, fontSize: '0.875rem' }} />
                <button className="btn btn-primary btn-sm" onClick={confirmTns} disabled={confirming} style={{ gap: 6, flexShrink: 0 }}>
                  <ClipboardCheck size={14} /> {confirming ? 'Confirmando…' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}

          {order.tns_confirmed && (
            <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={16} color="var(--success)" />
              <p style={{ fontSize: '0.875rem', color: 'var(--success)' }}>
                Confirmado en TNS — Ref: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{order.tns_confirmation_ref}</span>
              </p>
            </div>
          )}

          {/* Status actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {order.status === 'confirmed' && (
              <button className="btn btn-secondary btn-sm" onClick={() => advanceStatus('shipped')} disabled={advancing} style={{ color: 'var(--accent)', borderColor: 'rgba(34,211,238,0.25)' }}>
                <RefreshCw size={14} /> Marcar enviado
              </button>
            )}
            {order.status === 'shipped' && (
              <button className="btn btn-secondary btn-sm" onClick={() => advanceStatus('delivered')} disabled={advancing} style={{ color: 'var(--success)', borderColor: 'rgba(16,185,129,0.25)' }}>
                <CheckCircle2 size={14} /> Marcar entregado
              </button>
            )}
            {['paid', 'confirmed'].includes(order.status) && (
              <button className="btn btn-danger btn-sm" onClick={() => { if (confirm('Cancelar esta orden?')) advanceStatus('cancelled'); }} disabled={advancing}>
                Cancelar orden
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdvisorPanel() {
  const [tab, setTab] = useState<'pending' | 'all'>('pending');

  const endpoint = tab === 'pending' ? '/api/v1/orders/unassigned/' : '/api/v1/orders/?status=paid';
  const { data, isLoading, mutate } = useSWR<Order[] | { results: Order[] }>(endpoint, fetcher, { refreshInterval: 15000 });
  const orders: Order[] = Array.isArray(data) ? data : (data?.results ?? []);

  const { data: allPaid } = useSWR<{ count: number }>('/api/v1/orders/?status=paid', fetcher, { refreshInterval: 30000 });

  return (
    <PanelLayout
      title="Panel Asesor"
      subtitle="Confirmación manual de órdenes en TNS"
      allowedRoles={['advisor', 'admin', 'superadmin']}
      actions={
        <button className="btn btn-ghost btn-icon" onClick={() => mutate()} title="Actualizar">
          <RefreshCw size={16} />
        </button>
      }
    >
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="kpi-card">
          <p className="kpi-label">Sin confirmar</p>
          <p className="kpi-value" style={{ color: 'var(--warning)' }}>{isLoading ? '—' : orders.length}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Total pagadas</p>
          <p className="kpi-value">{(allPaid as any)?.count ?? '—'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 20 }}>
        {([['pending', 'Sin confirmar'], ['all', 'Todas pagadas']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-ghost'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Orders list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 62, borderRadius: 12 }} />
            ))
          : orders.length === 0
            ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <CheckCircle2 size={48} color="var(--success)" style={{ margin: '0 auto 16px', display: 'block' }} />
                <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Sin órdenes pendientes</p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6 }}>Todas las órdenes están al día</p>
              </div>
            )
            : orders.map(order => <OrderRow key={order.id} order={order} onRefresh={mutate} />)
        }
      </div>
    </PanelLayout>
  );
}
