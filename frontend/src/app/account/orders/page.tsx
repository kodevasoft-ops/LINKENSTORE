'use client';
import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Package, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import CatalogNavbar from '@/components/catalog/CatalogNavbar';
import { OrderRowSkeleton } from '@/components/ui/Skeletons';
import api from '@/lib/api';

interface OrderItem { id: string; product_name: string; unit_price: number; quantity: number; subtotal: number }
interface Order { id: string; order_number: string; status: string; status_display: string; total: number; discount_amount: number; coupon_code: string; items: OrderItem[]; shipping_address: string; shipping_city: string; created_at: string; delivered_at: string | null }

const fetcher = (url: string) => api.get(url).then(r => r.data);

const STATUS: Record<string, { color: string; bg: string; label: string }> = {
  pending:   { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: 'Pendiente de pago' },
  paid:      { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  label: 'Pagado' },
  confirmed: { color: '#818cf8', bg: 'rgba(129,140,248,0.1)', label: 'Confirmado' },
  shipped:   { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)',  label: 'Enviado' },
  delivered: { color: '#34d399', bg: 'rgba(52,211,153,0.1)',  label: 'Entregado' },
  cancelled: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', label: 'Cancelado' },
  refunded:  { color: '#f87171', bg: 'rgba(248,113,113,0.1)', label: 'Reembolsado' },
};

function OrderCard({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const s = STATUS[order.status] ?? STATUS.pending;

  return (
    <div className="glass-card" style={{ overflow: 'hidden' }}>
      <button onClick={() => setOpen(p => !p)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Package size={20} color={s.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.875rem', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700 }}>{order.order_number}</p>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {new Date(order.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}{order.items.length} producto{order.items.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            ${Number(order.total).toLocaleString('es-CO')}
          </p>
          <span style={{ display: 'inline-block', marginTop: 4, fontSize: '0.72rem', fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: s.bg, color: s.color }}>
            {s.label}
          </span>
        </div>
        {open ? <ChevronUp size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} /> : <ChevronDown size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Envío a</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{order.shipping_address}</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{order.shipping_city}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Productos</p>
              {order.items.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{item.quantity}x {item.product_name}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${Number(item.subtotal).toLocaleString('es-CO')}</span>
                </div>
              ))}
              {order.discount_amount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--success)', marginTop: 6 }}>
                  <span>Descuento ({order.coupon_code})</span>
                  <span>-${Number(order.discount_amount).toLocaleString('es-CO')}</span>
                </div>
              )}
            </div>
          </div>
          {order.status === 'delivered' && order.delivered_at && (
            <p style={{ fontSize: '0.78rem', color: 'var(--success)' }}>
              Entregado el {new Date(order.delivered_at).toLocaleDateString('es-CO')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) router.replace('/auth/login?next=/account/orders');
  }, [session, status, router]);

  const { data, isLoading } = useSWR<{ results: Order[] } | Order[]>(
    `/api/v1/orders/${filter ? `?status=${filter}` : ''}`, fetcher
  );
  const orders: Order[] = Array.isArray(data) ? data : (data?.results ?? []);

  const FILTERS = [
    { key: '',          label: 'Todas' },
    { key: 'paid',      label: 'En proceso' },
    { key: 'shipped',   label: 'Enviadas' },
    { key: 'delivered', label: 'Entregadas' },
    { key: 'cancelled', label: 'Canceladas' },
  ];

  if (status === 'loading') return <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} />;

  return (
    <>
      <CatalogNavbar />
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Link href="/" className="btn btn-ghost btn-icon"><ArrowLeft size={18} /></Link>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Mis órdenes</h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{orders.length} orden{orders.length !== 1 ? 'es' : ''} encontrada{orders.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ whiteSpace: 'nowrap' }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => <OrderRowSkeleton key={i} />)
            : orders.length === 0
              ? (
                <div style={{ textAlign: 'center', padding: '64px 0' }}>
                  <Package size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px', display: 'block' }} />
                  <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Sin órdenes</p>
                  <Link href="/catalog" className="btn btn-primary btn-sm" style={{ marginTop: 16, display: 'inline-flex' }}>Explorar catálogo</Link>
                </div>
              )
              : orders.map(o => <OrderCard key={o.id} order={o} />)
          }
        </div>
      </main>
    </>
  );
}
