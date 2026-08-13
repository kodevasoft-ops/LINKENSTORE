'use client';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Menu, Search, Bell, ShoppingCart, X } from 'lucide-react';
import { useUIStore, useCartStore } from '@/store';

interface TopbarProps {
  title?:    string;
  subtitle?: string;
  actions?:  React.ReactNode;
}

export default function Topbar({ title, subtitle, actions }: TopbarProps) {
  const { data: session } = useSession();
  const { toggleSidebar, setSearchOpen, setCartOpen } = useUIStore();
  const { itemCount } = useCartStore();
  const role      = (session?.user as any)?.role ?? '';
  const firstName = (session?.user as any)?.first_name ?? '';
  const email     = session?.user?.email ?? '';

  const isCustomer = role === 'customer';

  return (
    <header className="topbar">
      {/* Hamburger */}
      <button
        className="btn btn-ghost btn-icon"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Menu size={20} color="var(--text-secondary)" />
      </button>

      {/* Page title */}
      {(title || subtitle) && (
        <div style={{ marginRight: 'auto' }}>
          {title && (
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {title}
            </h2>
          )}
          {subtitle && (
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Spacer when no title */}
      {!title && !subtitle && <span style={{ flex: 1 }} />}

      {/* Custom actions */}
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div>}

      {/* Search */}
      <button
        className="btn btn-ghost btn-icon"
        onClick={() => setSearchOpen(true)}
        aria-label="Buscar"
      >
        <Search size={18} color="var(--text-secondary)" />
      </button>

      {/* Cart (customers only) */}
      {isCustomer && (
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => setCartOpen(true)}
          aria-label="Carrito"
          style={{ position: 'relative' }}
        >
          <ShoppingCart size={18} color="var(--text-secondary)" />
          {itemCount > 0 && (
            <span style={{
              position:   'absolute', top: 2, right: 2,
              width:       16, height: 16,
              background:  'var(--primary)',
              borderRadius:'50%',
              fontSize:    '0.6rem', fontWeight: 700, color: '#fff',
              display:     'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {itemCount > 9 ? '9+' : itemCount}
            </span>
          )}
        </button>
      )}

      {/* Notifications */}
      <button className="btn btn-ghost btn-icon" aria-label="Notificaciones">
        <Bell size={18} color="var(--text-secondary)" />
      </button>

      {/* Avatar */}
      <Link
        href={role === 'customer' ? '/account/orders' : '#'}
        style={{
          width:        36, height: 36,
          borderRadius: '50%',
          background:   'linear-gradient(135deg, var(--primary), var(--accent))',
          display:      'flex', alignItems: 'center', justifyContent: 'center',
          fontSize:     '0.82rem', fontWeight: 700, color: '#fff',
          textDecoration: 'none', flexShrink: 0,
        }}
      >
        {firstName?.[0]?.toUpperCase() || email[0]?.toUpperCase() || '?'}
      </Link>
    </header>
  );
}
