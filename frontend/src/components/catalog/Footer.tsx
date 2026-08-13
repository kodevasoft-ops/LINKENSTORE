import Link from 'next/link';
import { Package, Wrench, ClipboardList, Shield, FileText } from 'lucide-react';

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', marginTop: 64 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 24px 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 32 }}>
        {/* Brand */}
        <div>
          <h3 style={{ fontFamily: 'var(--font-jakarta)', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: 12 }}>
            kata<span style={{ color: 'var(--primary)' }}>log</span>
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Sistema de catálogo virtual enterprise con seguimiento de pedidos y reparaciones.
          </p>
        </div>

        {/* Catálogo */}
        <div>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Catálogo</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { href: '/catalog',        label: 'Ver todo', icon: <Package size={14} /> },
              { href: '/repairs/track',  label: 'Seguir reparación', icon: <Wrench size={14} /> },
            ].map(l => (
              <Link key={l.href} href={l.href} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                <span style={{ color: 'var(--text-muted)' }}>{l.icon}</span>{l.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Cuenta */}
        <div>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Cuenta</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { href: '/auth/login',     label: 'Iniciar sesión', icon: <Shield size={14} /> },
              { href: '/account/orders', label: 'Mis órdenes',    icon: <ClipboardList size={14} /> },
            ].map(l => (
              <Link key={l.href} href={l.href} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                <span style={{ color: 'var(--text-muted)' }}>{l.icon}</span>{l.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Legal */}
        <div>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Legal</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { href: '/terminos',    label: 'Términos',  icon: <FileText size={14} /> },
              { href: '/privacidad', label: 'Privacidad', icon: <Shield size={14} /> },
            ].map(l => (
              <Link key={l.href} href={l.href} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                <span style={{ color: 'var(--text-muted)' }}>{l.icon}</span>{l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} Katalog Enterprise. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
