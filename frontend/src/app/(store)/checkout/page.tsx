'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { checkoutApi, buildWompiCheckoutUrl, ApiError } from '@/lib/api';
import styles from './Checkout.module.css';

const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export default function CheckoutPage() {
  const { items, total, clear } = useCart();
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [form, setForm] = useState({
    full_name: '', phone: '', address: '', city: '', notes: '',
    document_type: 'CC', document_number: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = (session as unknown as { accessToken?: string })?.accessToken;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (sessionStatus !== 'authenticated' || !token) {
      setError('Debes iniciar sesión para completar la compra.');
      return;
    }
    if (items.length === 0) {
      setError('Tu carrito está vacío.');
      return;
    }

    setLoading(true);
    try {
      // 1. Crear la sesión de checkout (puede dividirse en varias Órdenes por punto internamente)
      const session = await checkoutApi.create(
        {
          items: items.map((i) => ({ product_id: i.id, quantity: i.qty })),
          shipping_address: form,
        },
        token
      );

      // 2. Pedir al backend los parámetros firmados del Web Checkout de Wompi
      const checkoutParams = await checkoutApi.getWompiParams(session.id, token);

      // 3. El carrito se vacía aquí — el pago real ocurre en el checkout hospedado de Wompi
      clear();
      window.location.href = buildWompiCheckoutUrl(checkoutParams);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar el pago. Intenta de nuevo.');
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <main className={styles.wrap2}>
        <h1 className={styles.title}>Checkout</h1>
        <p style={{ color: 'var(--muted)' }}>Tu carrito está vacío.</p>
      </main>
    );
  }

  return (
    <main className={styles.wrap2}>
      <h1 className={styles.title}>Finalizar compra</h1>

      <div className={styles.summary}>
        {items.map((i) => (
          <div key={i.id} className={styles.summaryRow}>
            <span>{i.qty}x {i.name}</span>
            <span>{currency.format(i.price * i.qty)}</span>
          </div>
        ))}
        <div className={styles.summaryTotal}>
          <span>Total</span>
          <span>{currency.format(total)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="full_name">Nombre completo</label>
          <input
            id="full_name" required
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          />
        </div>
        <div className={styles.row2}>
          <div className={styles.field}>
            <label htmlFor="document_type">Tipo de documento</label>
            <select
              id="document_type"
              value={form.document_type}
              onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value }))}
            >
              <option value="CC">Cédula de ciudadanía</option>
              <option value="CE">Cédula de extranjería</option>
              <option value="NIT">NIT</option>
              <option value="PA">Pasaporte</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="document_number">Número de documento</label>
            <input
              id="document_number" required
              value={form.document_number}
              onChange={(e) => setForm((f) => ({ ...f, document_number: e.target.value }))}
            />
          </div>
        </div>
        <div className={styles.row2}>
          <div className={styles.field}>
            <label htmlFor="phone">Teléfono</label>
            <input
              id="phone" required
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="city">Ciudad</label>
            <input
              id="city" required
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="address">Dirección de entrega</label>
          <input
            id="address" required
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="notes">Notas (opcional)</label>
          <textarea
            id="notes" rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>

        {error && (
          <div className={styles.error}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <button className={styles.payBtn} type="submit" disabled={loading}>
          {loading ? <Loader2 size={18} className="spin" /> : `Pagar ${currency.format(total)} con Wompi`}
        </button>
        <p className={styles.secureNote}>
          <ShieldCheck size={13} /> Pago procesado de forma segura por Wompi
        </p>
      </form>
    </main>
  );
}
