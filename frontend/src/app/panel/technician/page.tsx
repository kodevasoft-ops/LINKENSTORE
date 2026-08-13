'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { Wrench, Plus, X, Upload, Package, RefreshCw, CheckCircle2, Clock, Search, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import PanelLayout from '@/components/layout/PanelLayout';
import Modal from '@/components/ui/Modal';
import { RepairCardSkeleton } from '@/components/ui/Skeletons';
import api from '@/lib/api';

interface RepairPart   { id: string; name: string; quantity: number; unit_cost: number; subtotal: number }
interface RepairImage  { id: string; image: string; caption: string }
interface RepairTicket {
  id: string; ticket_number: string; status: string; status_display: string;
  customer_name: string; customer_phone: string; technician_name: string;
  device_type: string; device_brand: string; device_model: string; serial_number: string;
  reported_issue: string; diagnosis_notes: string; technician_notes: string;
  estimated_cost: number | null; final_cost: number | null; parts_total: number;
  parts: RepairPart[]; images: RepairImage[];
  received_at: string; ready_at: string | null;
}
interface Stats { total: number; received: number; diagnosis: number; in_progress: number; waiting_part: number; ready: number; delivered: number }

const fetcher = (url: string) => api.get(url).then(r => r.data);

const STATUS_FLOW = [
  { key: 'received',     label: 'Recibido',           color: '#64748b' },
  { key: 'diagnosis',    label: 'Diagnóstico',         color: '#3b82f6' },
  { key: 'in_progress',  label: 'En reparación',       color: '#f59e0b' },
  { key: 'waiting_part', label: 'Esperando repuesto',  color: '#f97316' },
  { key: 'ready',        label: 'Listo',               color: '#10b981' },
  { key: 'delivered',    label: 'Entregado',           color: '#8b5cf6' },
];

function statusInfo(key: string) { return STATUS_FLOW.find(s => s.key === key) ?? STATUS_FLOW[0]; }

function TicketModal({ ticket, onClose, onUpdated }: { ticket: RepairTicket; onClose: () => void; onUpdated: () => void }) {
  const [diagnosis, setDiagnosis] = useState(ticket.diagnosis_notes);
  const [notes,     setNotes]     = useState(ticket.technician_notes);
  const [finalCost, setFinalCost] = useState(ticket.final_cost?.toString() ?? '');
  const [saving,    setSaving]    = useState(false);
  const [newPart,   setNewPart]   = useState({ name: '', quantity: 1, unit_cost: 0 });
  const [addingPart,setAddingPart]= useState(false);
  const [uploading, setUploading] = useState(false);

  const currentIdx = STATUS_FLOW.findIndex(s => s.key === ticket.status);

  const saveNotes = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/v1/repairs/${ticket.id}/status/`, { status: ticket.status, diagnosis_notes: diagnosis, technician_notes: notes, ...(finalCost ? { final_cost: parseFloat(finalCost) } : {}) });
      toast.success('Notas guardadas'); onUpdated();
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const changeStatus = async (newStatus: string) => {
    setSaving(true);
    try {
      await api.patch(`/api/v1/repairs/${ticket.id}/status/`, { status: newStatus, diagnosis_notes: diagnosis, technician_notes: notes });
      toast.success(`Estado: ${statusInfo(newStatus).label}`); onUpdated(); onClose();
    } catch { toast.error('Error'); }
    finally { setSaving(false); }
  };

  const addPart = async () => {
    if (!newPart.name.trim()) return;
    setAddingPart(true);
    try {
      await api.post(`/api/v1/repairs/${ticket.id}/parts/`, newPart);
      setNewPart({ name: '', quantity: 1, unit_cost: 0 });
      toast.success('Repuesto añadido'); onUpdated();
    } catch { toast.error('Error'); }
    finally { setAddingPart(false); }
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    const fd = new FormData(); fd.append('image', file);
    try {
      await api.post(`/api/v1/repairs/${ticket.id}/images/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Foto subida'); onUpdated();
    } catch { toast.error('Error al subir'); }
    finally { setUploading(false); }
  };

  return (
    <Modal open onClose={onClose} title={`${ticket.ticket_number} — ${ticket.device_brand} ${ticket.device_model || ticket.device_type}`} maxWidth={680}
      footer={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
          <button className="btn btn-secondary btn-sm" onClick={saveNotes} disabled={saving}>{saving ? 'Guardando…' : 'Guardar notas'}</button>
          {STATUS_FLOW.filter(s => s.key !== ticket.status && s.key !== 'delivered').map(s => (
            <button key={s.key} onClick={() => changeStatus(s.key)} disabled={saving}
              className="btn btn-ghost btn-sm" style={{ color: s.color, borderColor: `${s.color}30` }}>
              {s.label}
            </button>
          ))}
          {ticket.status !== 'delivered' && (
            <button onClick={() => changeStatus('delivered')} disabled={saving}
              className="btn btn-sm" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
              Entregar
            </button>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Progress */}
        <div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {STATUS_FLOW.map((s, i) => (
              <div key={s.key} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= currentIdx ? s.color : 'var(--border)', transition: 'background 0.3s' }} />
            ))}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Estado: <span style={{ color: statusInfo(ticket.status).color, fontWeight: 700 }}>{ticket.status_display}</span>
          </p>
        </div>

        {/* Client info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 14, background: 'var(--bg-secondary)', borderRadius: 10 }}>
          <div><p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 3 }}>CLIENTE</p><p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 600 }}>{ticket.customer_name}</p><p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{ticket.customer_phone}</p></div>
          <div><p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 3 }}>EQUIPO</p><p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 600 }}>{ticket.device_type} {ticket.device_brand}</p>{ticket.serial_number && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>SN: {ticket.serial_number}</p>}</div>
        </div>

        {/* Issue */}
        <div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Problema reportado</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 10, padding: 12, lineHeight: 1.6 }}>{ticket.reported_issue}</p>
        </div>

        {/* Diagnosis textarea */}
        <div>
          <label className="input-label">Diagnóstico técnico</label>
          <textarea className="input" rows={3} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Describe el diagnóstico…" style={{ resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
        <div>
          <label className="input-label">Notas internas</label>
          <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionales…" style={{ resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        {/* Final cost */}
        <div>
          <label className="input-label">Costo final (COP)</label>
          <input type="number" className="input" value={finalCost} onChange={e => setFinalCost(e.target.value)}
            placeholder={ticket.estimated_cost ? `Estimado: $${Number(ticket.estimated_cost).toLocaleString('es-CO')}` : '0'} />
        </div>

        {/* Parts */}
        <div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>
            Repuestos {ticket.parts_total > 0 && `· Total: $${Number(ticket.parts_total).toLocaleString('es-CO')}`}
          </p>
          {ticket.parts.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 6, fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{p.quantity}x {p.name}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${Number(p.subtotal).toLocaleString('es-CO')}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input className="input" style={{ flex: 2, fontSize: '0.82rem' }} placeholder="Nombre repuesto" value={newPart.name} onChange={e => setNewPart(p => ({ ...p, name: e.target.value }))} />
            <input type="number" className="input" style={{ width: 60, fontSize: '0.82rem', textAlign: 'center' }} value={newPart.quantity} min={1} onChange={e => setNewPart(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} />
            <input type="number" className="input" style={{ width: 100, fontSize: '0.82rem' }} placeholder="$ unidad" value={newPart.unit_cost || ''} onChange={e => setNewPart(p => ({ ...p, unit_cost: parseFloat(e.target.value) || 0 }))} />
            <button className="btn btn-primary btn-sm" onClick={addPart} disabled={addingPart}><Plus size={14} /></button>
          </div>
        </div>

        {/* Images */}
        <div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>Fotos del equipo</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {ticket.images.map(img => (
              <div key={img.id} style={{ width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={img.image} alt={img.caption} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} disabled={uploading} />
            <span className="btn btn-secondary btn-sm" style={{ gap: 6 }}>
              <Upload size={14} /> {uploading ? 'Subiendo…' : 'Subir foto'}
            </span>
          </label>
        </div>
      </div>
    </Modal>
  );
}

export default function TechnicianPanel() {
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<RepairTicket | null>(null);

  const { data: stats } = useSWR<Stats>('/api/v1/repairs/stats/', fetcher, { refreshInterval: 20000 });
  const { data, isLoading, mutate } = useSWR<{ results: RepairTicket[] } | RepairTicket[]>(
    `/api/v1/repairs/${filterStatus ? `?status=${filterStatus}` : ''}`, fetcher, { refreshInterval: 20000 }
  );
  const tickets: RepairTicket[] = Array.isArray(data) ? data : (data?.results ?? []);

  const KPIS = [
    { label: 'Total',        value: stats?.total,        key: '',             icon: <Package size={16} /> },
    { label: 'Recibido',     value: stats?.received,     key: 'received',     icon: <Package size={16} /> },
    { label: 'Diagnóstico',  value: stats?.diagnosis,    key: 'diagnosis',    icon: <Search  size={16} /> },
    { label: 'Reparando',    value: stats?.in_progress,  key: 'in_progress',  icon: <Wrench  size={16} /> },
    { label: 'Esperando',    value: stats?.waiting_part, key: 'waiting_part', icon: <Clock   size={16} /> },
    { label: 'Listo',        value: stats?.ready,        key: 'ready',        icon: <CheckCircle2 size={16} /> },
  ];

  return (
    <PanelLayout title="Panel Técnico" subtitle="Reparaciones asignadas" allowedRoles={['technician','admin','superadmin']}
      actions={<button className="btn btn-ghost btn-icon" onClick={() => mutate()}><RefreshCw size={16} /></button>}
    >
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
        {KPIS.map(k => (
          <button key={k.key} onClick={() => setFilterStatus(k.key)}
            style={{ background: filterStatus === k.key ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)', border: `1px solid ${filterStatus === k.key ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`, borderRadius: 12, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s' }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: 6 }}>{k.label}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: filterStatus === k.key ? 'var(--primary)' : 'var(--text-primary)' }}>{k.value ?? '—'}</p>
          </button>
        ))}
      </div>

      {/* Tickets grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <RepairCardSkeleton key={i} />)
          : tickets.length === 0
            ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0' }}>
                <Wrench size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px', display: 'block' }} />
                <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Sin tickets en este estado</p>
              </div>
            )
            : tickets.map(ticket => {
              const info = statusInfo(ticket.status);
              return (
                <button key={ticket.id} onClick={() => setSelected(ticket)} style={{ textAlign: 'left', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, cursor: 'pointer', transition: 'all 0.2s', width: '100%' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = ''; }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 700 }}>{ticket.ticket_number}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: `${info.color}18`, color: info.color }}>{info.label}</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{ticket.device_brand} {ticket.device_model || ticket.device_type}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{ticket.reported_issue}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    <span>{ticket.customer_name}</span>
                    <span>{new Date(ticket.received_at).toLocaleDateString('es-CO')}</span>
                  </div>
                </button>
              );
            })
        }
      </div>

      {selected && (
        <TicketModal ticket={selected} onClose={() => setSelected(null)} onUpdated={() => { mutate(); }} />
      )}
    </PanelLayout>
  );
}
