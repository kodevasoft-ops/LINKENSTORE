'use client';
import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Wrench, CheckCircle, Clock, Package, AlertCircle, Truck } from 'lucide-react';
import api from '@/lib/api';

interface PublicTicket {
  ticket_number:  string;
  status:         string;
  status_display: string;
  device_type:    string;
  device_brand:   string;
  device_model:   string;
  technician_name:string;
  received_at:    string;
  ready_at:       string | null;
  delivered_at:   string | null;
}

const FLOW = [
  { key: 'received',     label: 'Recibido',            icon: <Package  size={18} /> },
  { key: 'diagnosis',     label: 'En diagnóstico',      icon: <Search   size={18} /> },
  { key: 'in_progress',   label: 'En reparación',       icon: <Wrench   size={18} /> },
  { key: 'waiting_part',  label: 'Esperando repuesto',  icon: <Clock    size={18} /> },
  { key: 'ready',         label: 'Listo para entrega',  icon: <CheckCircle size={18} /> },
  { key: 'delivered',     label: 'Entregado',           icon: <Truck    size={18} /> },
];

function getProgress(status: string) {
  const i = FLOW.findIndex(s => s.key === status);
  return i === -1 ? 0 : ((i + 1) / FLOW.length) * 100;
}

function TrackContent() {
  const searchParams = useSearchParams();
  const [ticketNum, setTicketNum] = useState(searchParams.get('ticket') ?? '');
  const [ticket,    setTicket]    = useState<PublicTicket | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const search = useCallback(async (num: string) => {
    const t = num.trim().toUpperCase();
    if (!t) return;
    setLoading(true); setError(''); setTicket(null);
    try {
      const { data } = await api.get('/api/v1/repairs/public/', { params: { ticket: t } });
      setTicket(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No encontramos ese ticket. Verifica el número.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = searchParams.get('ticket');
    if (t) search(t);
  }, []); // eslint-disable-line

  const currentIdx = ticket ? FLOW.findIndex(s => s.key === ticket.status) : -1;
  const isCancelled = ticket?.status === 'cancelled';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 16px 32px' }}>
      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', marginBottom: 8 }}>
        <h1 style={{ fontFamily: 'var(--font-jakarta)', fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          kata<span style={{ color: 'var(--primary)' }}>log</span>
        </h1>
      </Link>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 36 }}>Seguimiento de reparación</p>

      {/* Search */}
      <form onSubmit={e => { e.preventDefault(); search(ticketNum); }} style={{ width: '100%', maxWidth: 480, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="text" value={ticketNum} onChange={e => setTicketNum(e.target.value)}
            placeholder="REP-260618-0001"
            className="input" style={{ flex: 1, fontFamily: 'monospace', letterSpacing: '0.05em' }}
          />
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ gap: 8, flexShrink: 0 }}>
            {loading
              ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
              : <Search size={16} />
            }
            Buscar
          </button>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
          El número de ticket fue enviado al correo cuando entregaste el equipo
        </p>
      </form>

      {/* Error */}
      {error && (
        <div className="alert alert-error" style={{ width: '100%', maxWidth: 480, marginBottom: 16 }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}

      {/* Cancelled */}
      {ticket && isCancelled && (
        <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, padding: 28, textAlign: 'center' }}>
          <AlertCircle size={40} color="var(--danger)" style={{ margin: '0 auto 14px', display: 'block' }} />
          <p style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: 8 }}>Reparación cancelada</p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Contacta a la tienda para más información sobre el ticket <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{ticket.ticket_number}</span>
          </p>
        </div>
      )}

      {/* Result */}
      {ticket && !isCancelled && (
        <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', animation: 'slideUp 0.3s ease' }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(34,211,238,0.08))', padding: '24px 28px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Ticket</p>
            <p style={{ fontFamily: 'monospace', fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)', marginBottom: 6 }}>{ticket.ticket_number}</p>
            <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {ticket.device_brand} {ticket.device_model || ticket.device_type}
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Recibido el {new Date(ticket.received_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* Progress bar */}
          <div style={{ padding: '20px 28px 0' }}>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${getProgress(ticket.status)}%` }} />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, marginBottom: 20 }}>
              Estado: <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{ticket.status_display}</span>
            </p>
          </div>

          {/* Timeline */}
          <div style={{ padding: '0 28px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FLOW.map((s, i) => {
              const isDone    = i < currentIdx;
              const isCurrent = i === currentIdx;
              return (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isCurrent ? 'var(--primary)' : isDone ? 'rgba(16,185,129,0.15)' : 'var(--bg-card-hover)',
                    border: isCurrent ? '2px solid rgba(99,102,241,0.4)' : isDone ? '2px solid rgba(16,185,129,0.3)' : '2px solid var(--border)',
                    transition: 'all 0.3s',
                  }}>
                    <span style={{ color: isCurrent ? '#fff' : isDone ? 'var(--success)' : 'var(--text-muted)' }}>
                      {isDone ? <CheckCircle size={16} /> : s.icon}
                    </span>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'var(--text-primary)' : isDone ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                      {s.label}
                    </p>
                    {isCurrent && <p style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: 2 }}>Estado actual</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Técnico asignado</span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{ticket.technician_name}</span>
          </div>

          {/* Ready alert */}
          {ticket.status === 'ready' && (
            <div style={{ margin: '0 20px 20px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
              <p style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 4 }}>Tu equipo está listo</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Puedes pasar a recogerlo en nuestra tienda.</p>
            </div>
          )}
        </div>
      )}

      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 32 }}>
        Necesitas ayuda?{' '}
        <Link href="/" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Contáctanos</Link>
      </p>
    </div>
  );
}

export default function RepairsTrackPage() {
  return <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} />}><TrackContent /></Suspense>;
}
