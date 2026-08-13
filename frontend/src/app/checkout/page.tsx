'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { MapPin, CreditCard, CheckCircle2, Clock, Tag, Package, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCartStore, useAuthStore } from '@/store';
import { useAnalytics } from '@/hooks/useAnalytics';
import CatalogNavbar from '@/components/catalog/CatalogNavbar';
import api from '@/lib/api';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || '');
type Step = 'address' | 'payment' | 'confirmation';

// ── Urgency banner ────────────────────────────────────────────────────────────
function UrgencyBanner({ itemsCount }: { itemsCount: number }) {
  const [secs, setSecs] = useState(600);
  useEffect(() => {
    const t = setInterval(() => setSecs(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const mins = String(Math.floor(secs / 60)).padStart(2, '0');
  const s    = String(secs % 60).padStart(2, '0');
  const urgent = secs < 120;
  if (secs === 0) return null;
  return (
    <div style={{ background: urgent ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${urgent ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <Clock size={16} color={urgent ? 'var(--danger)' : 'var(--warning)'} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: urgent ? 'var(--danger)' : 'var(--warning)' }}>
          {urgent ? 'Últimos minutos — completa tu compra' : 'Tu carrito está reservado'}
        </p>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {itemsCount} producto{itemsCount !== 1 ? 's' : ''} reservado{itemsCount !== 1 ? 's' : ''} por{' '}
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: urgent ? 'var(--danger)' : 'var(--warning)' }}>{mins}:{s}</span>
        </p>
      </div>
    </div>
  );
}

// ── Stripe payment form ───────────────────────────────────────────────────────
function PaymentForm({ orderId, onSuccess }: { orderId: string; onSuccess: () => void }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/checkout/success?order=${orderId}` },
      redirect: 'if_required',
    });
    if (error) { toast.error(error.message || 'Error al procesar el pago'); setProcessing(false); }
    else onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PaymentElement />
      <button type="submit" disabled={!stripe || processing} className="btn btn-primary btn-full btn-lg" style={{ gap: 8 }}>
        {processing
          ? <><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} /> Procesando…</>
          : <><CreditCard size={18} /> Pagar ahora (Pago seguro)</>
        }
      </button>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Pago cifrado y procesado por Stripe</p>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const router  = useRouter();
  const { items, total, itemCount, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const { trackCart, trackCartAbandonment } = useAnalytics();

  const [step,         setStep]         = useState<Step>('address');
  const [orderId,      setOrderId]      = useState('');
  const [orderNum,     setOrderNum]     = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [coupon,       setCoupon]       = useState('');
  const [discount,     setDiscount]     = useState(0);
  const [submitting,   setSubmitting]   = useState(false);
  const [couponErr,    setCouponErr]    = useState('');
  const completedRef = useRef(false);

  const [addr, setAddr] = useState({
    full_name: user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() : '',
    phone: '', address: '', city: '', notes: '',
  });

  // Redirect if cart empty
  useEffect(() => {
    if (itemCount === 0 && step !== 'confirmation') router.replace('/catalog');
  }, [itemCount, step, router]);

  // Track abandonment on unmount
  useEffect(() => {
    return () => {
      if (!completedRef.current && itemCount > 0) {
        trackCartAbandonment({ cartTotal: total, itemsCount: itemCount, email: user?.email, lastStep: step });
      }
    };
  }, []); // eslint-disable-line

  const handleAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post('/api/v1/orders/', {
        items: items.map(i => ({ product_id: i.id, quantity: i.qty })),
        shipping_address: addr,
        coupon_code: coupon || undefined,
      });
      setOrderId(data.id);
      setOrderNum(data.order_number);
      setClientSecret(data.client_secret);
      setStep('payment');
      trackCart('start_checkout', { itemsCount: itemCount, cartTotal: total });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.detail || 'Error al procesar la orden');
    } finally { setSubmitting(false); }
  };

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    try {
      const { data } = await api.post('/api/v1/orders/validate-coupon/', { code: coupon });
      setDiscount(data.discount_pct); setCouponErr('');
      toast.success(`Cupón aplicado: -${data.discount_pct}%`);
    } catch { setCouponErr('Cupón inválido'); setDiscount(0); }
  };

  const onPaymentSuccess = () => {
    completedRef.current = true;
    trackCart('complete_order', { itemsCount: itemCount, cartTotal: total });
    clearCart();
    setStep('confirmation');
  };

  const finalTotal = total * (1 - discount / 100);

  const STEPS = [
    { key: 'address',      label: 'Dirección', icon: <MapPin size={16} /> },
    { key: 'payment',      label: 'Pago',       icon: <CreditCard size={16} /> },
    { key: 'confirmation', label: 'Confirmado', icon: <CheckCircle2 size={16} /> },
  ] as const;

  return (
    <>
      <CatalogNavbar />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 36 }}>
          {STEPS.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 99, background: step === s.key ? 'rgba(99,102,241,0.15)' : 'transparent', transition: 'all 0.2s' }}>
                <span style={{ color: step === s.key ? 'var(--primary)' : STEPS.findIndex(x => x.key === step) > i ? 'var(--success)' : 'var(--text-muted)' }}>{s.icon}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: step === s.key ? 700 : 500, color: step === s.key ? 'var(--primary)' : STEPS.findIndex(x => x.key === step) > i ? 'var(--success)' : 'var(--text-muted)' }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div style={{ width: 40, height: 1, background: 'var(--border)', margin: '0 4px' }} />}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32 }}>
          {/* Left column */}
          <div>
            {step !== 'confirmation' && <UrgencyBanner itemsCount={itemCount} />}

            {/* Address step */}
            {step === 'address' && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                  <MapPin size={20} color="var(--primary)" />
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Dirección de envío</h2>
                </div>
                <form onSubmit={handleAddress} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="input-label">Nombre completo</label>
                      <input required className="input" value={addr.full_name} onChange={e => setAddr(p => ({ ...p, full_name: e.target.value }))} placeholder="Juan Pérez" />
                    </div>
                    <div>
                      <label className="input-label">Teléfono</label>
                      <input required className="input" value={addr.phone} onChange={e => setAddr(p => ({ ...p, phone: e.target.value }))} placeholder="+57 300 000 0000" />
                    </div>
                  </div>
                  <div>
                    <label className="input-label">Dirección</label>
                    <input required className="input" value={addr.address} onChange={e => setAddr(p => ({ ...p, address: e.target.value }))} placeholder="Calle, carrera, barrio" />
                  </div>
                  <div>
                    <label className="input-label">Ciudad</label>
                    <input required className="input" value={addr.city} onChange={e => setAddr(p => ({ ...p, city: e.target.value }))} placeholder="Bogotá, Medellín…" />
                  </div>
                  <div>
                    <label className="input-label">Notas de entrega (opcional)</label>
                    <textarea className="input" rows={2} value={addr.notes} onChange={e => setAddr(p => ({ ...p, notes: e.target.value }))} placeholder="Apto, piso, referencias…" style={{ resize: 'vertical', fontFamily: 'inherit' }} />
                  </div>
                  <button type="submit" disabled={submitting} className="btn btn-primary btn-full btn-lg">
                    {submitting ? 'Procesando…' : 'Continuar al pago'}
                  </button>
                </form>
              </div>
            )}

            {/* Payment step */}
            {step === 'payment' && clientSecret && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                  <CreditCard size={20} color="var(--primary)" />
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Método de pago</h2>
                </div>
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#6366f1', borderRadius: '10px', fontFamily: 'var(--font-inter)' } } }}>
                  <PaymentForm orderId={orderId} onSuccess={onPaymentSuccess} />
                </Elements>
              </div>
            )}

            {/* Confirmation */}
            {step === 'confirmation' && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 16, padding: 40, textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '2px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <CheckCircle2 size={36} color="var(--success)" />
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>Compra completada</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 6 }}>
                  Tu orden <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700 }}>{orderNum}</span> fue recibida.
                </p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 28 }}>Un asesor confirmará y procesará tu pedido a la brevedad.</p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a href="/account/orders" className="btn btn-primary">Ver mis órdenes</a>
                  <a href="/" className="btn btn-secondary">Seguir comprando</a>
                </div>
              </div>
            )}
          </div>

          {/* Right — Order summary */}
          {step !== 'confirmation' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 22, position: 'sticky', top: 80 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
                  Resumen ({itemCount} productos)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 260, overflowY: 'auto', marginBottom: 16 }}>
                  {items.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-card-hover)', overflow: 'hidden', flexShrink: 0 }}>
                          {item.image ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={16} style={{ margin: 10 }} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>x{item.qty}</p>
                        </div>
                      </div>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', fontWeight: 600, flexShrink: 0 }}>
                        ${(item.price * item.qty).toLocaleString('es-CO')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Coupon (address step only) */}
                {step === 'address' && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Tag size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <input type="text" value={coupon} onChange={e => { setCoupon(e.target.value); setCouponErr(''); }}
                          placeholder="Cupón" className="input" style={{ paddingLeft: 32, fontSize: '0.82rem' }} />
                      </div>
                      <button className="btn btn-secondary btn-sm" onClick={applyCoupon}>Aplicar</button>
                    </div>
                    {couponErr && <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: 4 }}>{couponErr}</p>}
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <span>Subtotal</span>
                    <span className="tabular">${total.toLocaleString('es-CO')}</span>
                  </div>
                  {discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--success)' }}>
                      <span>Descuento ({coupon})</span>
                      <span>-{discount}%</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>
                    <span>Total</span>
                    <span className="tabular">${finalTotal.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
