'use client';
import { useUIStore } from '@/store';
import { Search, Shield, Truck, Wrench, CreditCard } from 'lucide-react';

export default function HeroSection() {
  const { setSearchOpen } = useUIStore();

  return (
    <section style={{
      position: 'relative', overflow: 'hidden',
      borderBottom: '1px solid var(--border)',
      padding: '64px 24px 48px',
    }}>
      {/* Background gradient */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(99,102,241,0.12) 0%, transparent 70%)',
      }} />
      <div style={{
        position: 'absolute', top: -60, right: -60,
        width: 300, height: 300, borderRadius: '50%',
        background: 'rgba(34,211,238,0.05)', filter: 'blur(60px)', pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
        {/* Badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 99, padding: '4px 14px',
          fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-light)',
          marginBottom: 20,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }} />
          Catálogo actualizado en tiempo real
        </span>

        <h1 style={{
          fontFamily: 'var(--font-jakarta)',
          fontSize: 'clamp(1.8rem, 5vw, 3rem)',
          fontWeight: 800, letterSpacing: '-0.03em',
          color: 'var(--text-primary)', lineHeight: 1.15,
          marginBottom: 16,
        }}>
          Todo lo que necesitas,{' '}
          <span className="text-gradient">en un solo lugar</span>
        </h1>

        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32, maxWidth: 520, margin: '0 auto 32px' }}>
          Catálogo virtual con seguimiento en tiempo real de tus pedidos y reparaciones. Calidad garantizada.
        </p>

        {/* Search CTA */}
        <button
          onClick={() => setSearchOpen(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            background: 'var(--bg-card)', border: '1px solid var(--border-light)',
            borderRadius: 12, padding: '14px 24px', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '0.9rem',
            transition: 'all 0.2s', width: '100%', maxWidth: 480,
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
        >
          <Search size={18} />
          <span style={{ flex: 1, textAlign: 'left' }}>Buscar productos, marcas, referencias…</span>
          <kbd style={{ fontSize: '0.72rem', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', background: 'var(--bg-secondary)' }}>
            Buscar
          </kbd>
        </button>

        {/* Trust badges */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center',
          justifyContent: 'center', gap: 24, marginTop: 36,
        }}>
          {[
            { icon: <Truck size={15} />,     label: 'Envío rápido' },
            { icon: <Shield size={15} />,    label: 'Garantía real' },
            { icon: <Wrench size={15} />,    label: 'Servicio técnico' },
            { icon: <CreditCard size={15} />,label: 'Pago seguro' },
          ].map(b => (
            <span key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--primary)' }}>{b.icon}</span>
              {b.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
