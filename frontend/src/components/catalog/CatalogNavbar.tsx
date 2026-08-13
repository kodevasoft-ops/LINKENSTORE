'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Menu, Search, ShoppingCart, User, ChevronDown, Wrench, X, LogOut, Package, ClipboardList, BarChart3 } from 'lucide-react';
import { useUIStore, useCartStore } from '@/store';
import SearchModal from './SearchModal';
import CartDrawer from './CartDrawer';

const ROLE_PANEL: Record<string, string> = {
  superadmin: '/panel/superadmin',
  admin:      '/panel/admin',
  advisor:    '/panel/advisor',
  technician: '/panel/technician',
};

export default function CatalogNavbar() {
  const { data: session } = useSession();
  const { itemCount }     = useCartStore();
  const { cartOpen, setCartOpen, searchOpen, setSearchOpen } = useUIStore();
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const role      = (session?.user as any)?.role ?? '';
  const firstName = (session?.user as any)?.first_name ?? '';

  return (
    <>
      <nav style={{
        position:       'sticky', top: 0, zIndex: 40,
        background:     'var(--glass-bg)',
        backdropFilter: 'blur(20px)',
        borderBottom:   '1px solid var(--glass-border)',
        height:         64,
        display:        'flex', alignItems: 'center',
        padding:        '0 24px', gap: 12,
      }}>
        {/* Mobile hamburger */}
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => setMobileOpen(p => !p)}
          style={{ display: 'none' }}
          id="mobile-nav-btn"
          aria-label="Menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <span style={{
            fontFamily: 'var(--font-jakarta)', fontWeight: 800,
            fontSize: '1.25rem', letterSpacing: '-0.02em', color: 'var(--text-primary)',
          }}>
            kata<span style={{ color: 'var(--primary)' }}>log</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, marginLeft: 16 }}
             className="desktop-nav">
          <Link href="/catalog" className="btn btn-ghost" style={{ fontSize: '0.875rem' }}>
            <Package size={16} /> Catálogo
          </Link>
          <Link href="/repairs/track" className="btn btn-ghost" style={{ fontSize: '0.875rem' }}>
            <Wrench size={16} /> Reparaciones
          </Link>
        </div>

        {/* Search bar */}
        <button
          onClick={() => setSearchOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '0.85rem',
            transition: 'border-color 0.15s',
            minWidth: 180, maxWidth: 280, flex: '0 1 260px',
          }}
        >
          <Search size={16} />
          <span>Buscar productos…</span>
        </button>

        {/* Icons */}
        <button className="btn btn-ghost btn-icon" onClick={() => setSearchOpen(true)} aria-label="Buscar">
          <Search size={18} color="var(--text-secondary)" />
        </button>

        {/* Cart */}
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => setCartOpen(true)}
          style={{ position: 'relative' }}
          aria-label="Carrito"
        >
          <ShoppingCart size={18} color="var(--text-secondary)" />
          {itemCount > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: 2,
              width: 16, height: 16, borderRadius: '50%',
              background: 'var(--primary)', fontSize: '0.6rem',
              fontWeight: 700, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {itemCount > 9 ? '9+' : itemCount}
            </span>
          )}
        </button>

        {/* User menu */}
        {session ? (
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-ghost"
              onClick={() => setMenuOpen(p => !p)}
              style={{ gap: 6, fontSize: '0.85rem' }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {firstName?.[0]?.toUpperCase() || '?'}
              </div>
              <span className="hide-mobile">{firstName}</span>
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>

            {menuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setMenuOpen(false)} />
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  width: 220, background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 14, overflow: 'hidden', zIndex: 50,
                  boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                  animation: 'slideUp 0.15s ease',
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{firstName}</p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{session.user?.email}</p>
                  </div>
                  {ROLE_PANEL[role] && (
                    <Link href={ROLE_PANEL[role]} onClick={() => setMenuOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)', textDecoration: 'none', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <BarChart3 size={16} /> Panel
                    </Link>
                  )}
                  <Link href="/account/orders" onClick={() => setMenuOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <ClipboardList size={16} /> Mis órdenes
                  </Link>
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    <button onClick={() => signOut({ callbackUrl: '/' })}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: '0.85rem', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}>
                      <LogOut size={16} /> Cerrar sesión
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <Link href="/auth/login" className="btn btn-primary btn-sm">
            <User size={16} /> Ingresar
          </Link>
        )}
      </nav>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CartDrawer  open={cartOpen}   onClose={() => setCartOpen(false)} />

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          #mobile-nav-btn { display: flex !important; }
          .hide-mobile { display: none; }
        }
      `}</style>
    </>
  );
}
