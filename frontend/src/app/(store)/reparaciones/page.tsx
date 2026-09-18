'use client';

import { useState } from 'react';
import { Wrench, Search, Loader2, AlertCircle, Smartphone } from 'lucide-react';
import { repairsApi, type RepairPublicTracking } from '@/lib/api';

export default function ReparacionesPage() {
  const [ticket, setTicket] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RepairPublicTracking | null | undefined>(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket.trim()) return;
    setLoading(true);
    const res = await repairsApi.publicTracking(ticket.trim());
    setResult(res);
    setLoading(false);
  };

  return (
    <main className="wrap" style={{ maxWidth: 560, padding: '60px 20px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <Wrench size={32} color="var(--y)" style={{ margin: '0 auto 14px' }} />
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Rastrear mi reparación</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Ingresa el número de ticket que recibiste al dejar tu equipo.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <input
          placeholder="REP-260824-0001"
          value={ticket}
          onChange={(e) => setTicket(e.target.value)}
          style={{
            flex: 1, padding: '13px 16px', borderRadius: 12, background: 'var(--surf)',
            border: '1px solid var(--bdr2)', color: 'var(--txt)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
          }}
        />
        <button
          type="submit" disabled={loading}
          style={{ padding: '0 22px', borderRadius: 12, background: 'var(--y)', color: '#000', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
          Buscar
        </button>
      </form>

      {result === null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: 13 }}>
          <AlertCircle size={16} /> No encontramos un ticket con ese número.
        </div>
      )}

      {result && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--bdr2)', borderRadius: 16, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Smartphone size={20} color="var(--y)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{result.device_type} {result.device_brand} {result.device_model}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{result.ticket_number}</div>
            </div>
          </div>
          <div style={{
            display: 'inline-block', fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8,
            background: 'rgba(173,173,3,0.15)', color: 'var(--y)', marginBottom: 14,
          }}>
            {result.status_display}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Técnico asignado: {result.technician_name}</span>
            <span>Recibido: {new Date(result.received_at).toLocaleDateString('es-CO')}</span>
            {result.ready_at && <span>Listo desde: {new Date(result.ready_at).toLocaleDateString('es-CO')}</span>}
            {result.delivered_at && <span>Entregado: {new Date(result.delivered_at).toLocaleDateString('es-CO')}</span>}
          </div>
        </div>
      )}
    </main>
  );
}
