'use client';

import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useCart } from '@/lib/cart-context';
import styles from './CartDrawer.module.css';

const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { items, total, changeQty, remove } = useCart();
  const router = useRouter();

  const goToCheckout = () => {
    onClose();
    router.push('/checkout');
  };

  return (
    <>
      <div className={`${styles.overlay} ${open ? styles.on : ''}`} onClick={onClose} />
      <aside className={`${styles.panel} ${open ? styles.on : ''}`} aria-hidden={!open}>
        <div className={styles.head}>
          <h2>Tu carrito</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar carrito">
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {items.length === 0 ? (
            <div className={styles.empty}>
              <ShoppingBag size={32} strokeWidth={1.5} />
              <p>Tu carrito está vacío.</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className={styles.item}>
                <div className={styles.itemImg}>
                  {item.image && <Image src={item.image} alt={item.name} fill sizes="60px" style={{ objectFit: 'cover' }} />}
                </div>
                <div className={styles.itemInfo}>
                  <div className={styles.itemCat}>{item.areaName}</div>
                  <div className={styles.itemName}>{item.name}</div>
                  <div className={styles.itemBottom}>
                    <span className={styles.itemPrice}>{currency.format(item.price)}</span>
                    <div className={styles.qtyRow}>
                      <button className={styles.qtyBtn} onClick={() => changeQty(item.id, -1)} aria-label="Reducir cantidad">
                        <Minus size={12} />
                      </button>
                      <span className={styles.qtyN}>{item.qty}</span>
                      <button className={styles.qtyBtn} onClick={() => changeQty(item.id, 1)} aria-label="Aumentar cantidad" disabled={item.qty >= item.stock}>
                        <Plus size={12} />
                      </button>
                      <button className={styles.removeBtn} onClick={() => remove(item.id)} aria-label="Quitar producto">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.totalRow}>
            <span>Total</span>
            <span>{currency.format(total)}</span>
          </div>
          <button className={styles.checkoutBtn} onClick={goToCheckout} disabled={items.length === 0}>
            Continuar al pago
          </button>
        </div>
      </aside>
    </>
  );
}
