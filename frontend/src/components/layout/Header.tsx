'use client';

import Link from 'next/link';
import { Search, Heart, ShoppingBag, User, Sun, Moon, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useCart } from '@/lib/cart-context';
import styles from './Header.module.css';

interface HeaderProps {
  onOpenCart: () => void;
  onOpenLogin: () => void;
  wishlistCount: number;
}

const ROLE_LABELS: Record<string, string> = {
  customer: 'Cliente',
  advisor: 'Vendedor',
  technician: 'Técnico',
  admin: 'Administrador',
  superadmin: 'SuperAdmin',
};

export default function Header({ onOpenCart, onOpenLogin, wishlistCount }: HeaderProps) {
  const { count } = useCart();
  const { data: session, status } = useSession();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <header className={styles.header}>
      <div className={`wrap ${styles.bar}`}>
        <Link href="/" className={styles.logo}>
          Celu<em>Fénix</em>
        </Link>

        <div className={styles.actions}>
          <Link href="/productos" className={styles.iconBtn} aria-label="Buscar productos">
            <Search size={18} strokeWidth={2} />
          </Link>

          <button className={styles.iconBtn} onClick={toggleTheme} aria-label="Cambiar tema">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button className={styles.iconBtn} aria-label="Lista de favoritos">
            <Heart size={18} />
            <span className={`${styles.badge} ${wishlistCount > 0 ? styles.on : ''}`}>
              {wishlistCount}
            </span>
          </button>

          <button className={styles.iconBtn} onClick={onOpenCart} aria-label="Carrito de compras">
            <ShoppingBag size={18} />
            <span className={`${styles.badge} ${count > 0 ? styles.on : ''}`}>{count}</span>
          </button>

          {status === 'authenticated' && session?.user ? (
            <div className={styles.userMenu}>
              {(session.user as { role?: string }).role === 'customer' ? (
                <Link href="/cuenta" className={styles.userName}>
                  {session.user.name || session.user.email}
                  <em>Mi cuenta</em>
                </Link>
              ) : (
                <Link href="/panel/ventas" className={styles.userName}>
                  {session.user.name || session.user.email}
                  <em>{ROLE_LABELS[(session.user as { role?: string }).role || ''] || ''}</em>
                </Link>
              )}
              <button className={styles.iconBtn} onClick={() => signOut()} aria-label="Cerrar sesión">
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button className={styles.iconBtn} onClick={onOpenLogin} aria-label="Iniciar sesión">
              <User size={18} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
