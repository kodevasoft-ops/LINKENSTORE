'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { X, ShoppingCart, Minus, Plus, Trash2, Tag, ArrowRight, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCartStore, useAuthStore } from '@/store';
import { useAnalytics } from '@/hooks/useAnalytics';
import api from '@/lib/api';

interface Props { open: boolean; onClose: () => void }

export default function CartDrawer({ open, onClose }: Props) {
  const router = useRouter();
  const { items, removeItem, updateQty, clearCart, total, itemCount } = useCartStore();
  const { user } = useAuthStore();
  const { trackCart, trackCartAbandonment } = useAnalytics();

  const [coupon,      setCoupon]      = useState('');
  const [couponErr,   setCouponErr]   = useState('');
  const [discount,    setDiscount]    = useState(0);
  const [applying,    setApplying]    = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    if (open && itemCount > 0) trackCart('view_cart', { itemsCount: itemCount, cartTotal: total });
  }, [open]); // eslint-disable-line

  const handleClose = useCallback(() => {
    if (itemCount > 0) trackCartAbandonment({ cartTotal: total, itemsCount: itemCount, email: user?.email });
    onClose();
  }, [itemCount, total, user, onClose, trackCartAbandonment]);

  const handleRemove = (id: string, name: string) => {
    removeItem(id);
    trackCart('remove_item', { itemsCount: itemCount - 1, cartTotal: total });
    toast.success(`${name} eliminado`);
  };

  const handleQty = (id: string, qty: number) => {
    updateQty(id, qty);
    trackCart('update_qty', { itemsCount: itemCount, cartTotal: total });
  };

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    setApplying(true);
    try {
      const { data } = await api.post('/api/v1/orders/validate-coupon/', { code: coupon });
      setDiscount(data.discount_pct);
      setCouponErr('');
      toast.success(`Cupón aplicado: -${data.discount_pct}%`);
    } catch {
      setCouponErr('Cupón inválido o expirado');
      setDiscount(0);
    } finally { setApplying(false); }
  };

  const handleCheckout = () => {
    if (!user) { toast.error('Debes iniciar sesión para continuar'); router.push('/auth/login'); return; }
    setCheckingOut(true);
    trackCart('start_checkout', { itemsCount: itemCount, cartTotal: total });
    onClose();
    router.push('/checkout');
  };

  const finalTotal = total * (1 - discount / 100);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 90, backdropFilter: 'blur(2px)',
          opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', right: 0, top: 0, height: '100vh',
        width: '100%', maxWidth: 400, zIndex: 91,
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShoppingCart size={20} color="var(--primary)" />
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Carrito</span>
            {itemCount > 0 && (
              <span className="badge badge-primary">{itemCount}</span>
            )}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={handleClose}><X size={18} /></button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 16 }}>
              <div style={{ width: 64, height: 64, background: 'var(--bg-card)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart size={28} color="var(--text-muted)" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Tu carrito está vacío</p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>Agrega productos del catálogo</p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => { onClose(); router.push('/catalog'); }}>
                Explorar catálogo
              </button>
            </div>
          ) : items.map(item => (
            <div key={item.id} style={{ display: 'flex', gap: 12, background: 'var(--bg-card)', borderRadius: 12, padding: 12, border: '1px solid var(--border)' }}>
              {/* Image */}
              <div style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-card-hover)', flexShrink: 0 }}>
                {item.image
                  ? <Image src={item.image} alt={item.name} width={64} height={64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={24} color="var(--text-muted)" /></div>
                }
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  ${Number(item.price).toLocaleString('es-CO')} c/u
                </p>
                {/* Qty */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-ghost btn-icon" style={{ width: 26, height: 26, padding: 0 }}
                    onClick={() => item.qty > 1 ? handleQty(item.id, item.qty - 1) : handleRemove(item.id, item.name)}>
                    <Minus size={13} />
                  </button>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                  <button className="btn btn-ghost btn-icon" style={{ width: 26, height: 26, padding: 0 }}
                    onClick={() => handleQty(item.id, item.qty + 1)}>
                    <Plus size={13} />
                  </button>
                </div>
              </div>
              {/* Price + delete */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <button className="btn btn-ghost btn-icon" style={{ width: 28, height: 28, padding: 0, color: 'var(--danger)' }}
                  onClick={() => handleRemove(item.id, item.name)}>
                  <Trash2 size={14} />
                </button>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  ${(item.price * item.qty).toLocaleString('es-CO')}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
            {/* Coupon */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Tag size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="text" value={coupon} placeholder="Cupón de descuento"
                  onChange={e => { setCoupon(e.target.value); setCouponErr(''); }}
                  className="input" style={{ paddingLeft: 36, fontSize: '0.82rem' }}
                />
              </div>
              <button className="btn btn-secondary btn-sm" onClick={applyCoupon} disabled={applying}>
                {applying ? '…' : 'Aplicar'}
              </button>
            </div>
            {couponErr && <p style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>{couponErr}</p>}
            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Descuento</span>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>-{discount}%</span>
              </div>
            )}
            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Total</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                ${finalTotal.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
              </span>
            </div>
            {/* CTA */}
            <button className="btn btn-primary btn-full" onClick={handleCheckout} disabled={checkingOut}>
              {checkingOut ? 'Procesando…' : <><span>Ir al pago</span><ArrowRight size={16} /></>}
            </button>
            <button onClick={() => { clearCart(); trackCart('view_cart', { itemsCount: 0, cartTotal: 0 }); }}
              style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'center' }}>
              Vaciar carrito
            </button>
          </div>
        )}
      </div>
    </>
  );
}
