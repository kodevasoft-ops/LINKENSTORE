'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Loader2, PackageX, Save, ImagePlus, UserCog, Eye, X } from 'lucide-react';
import { repairsApi, type RepairTicket, ApiError } from '@/lib/api';
import styles from './TicketDetail.module.css';

const STATUS_OPTIONS = [
  { value: 'received', label: 'Recibido' },
  { value: 'diagnosis', label: 'En diagnóstico' },
  { value: 'in_progress', label: 'En reparación' },
  { value: 'waiting_part', label: 'Esperando repuesto' },
  { value: 'ready', label: 'Listo para entrega' },
  { value: 'delivered', label: 'Entregado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const { data: session } = useSession();
  const token = (session as unknown as { accessToken?: string })?.accessToken;
  const role = (session?.user as { role?: string })?.role || '';
  const userId = (session?.user as { id?: string })?.id;

  const [ticket, setTicket] = useState<RepairTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newPart, setNewPart] = useState({ name: '', quantity: '1', unit_cost: '' });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setTicket(await repairsApi.detail(id, token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el ticket.');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  const isReadOnly = role === 'supervisor';
  const canEdit = !isReadOnly && ticket && (
    role === 'administrador_tecnico' || role === 'superadmin' ||
    (role === 'tecnico' && ticket.technician === userId)
  );
  const canAssign = role === 'administrador_tecnico' || role === 'superadmin';

  const handleSave = async () => {
    if (!ticket || !token) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await repairsApi.updateStatus(id, {
        status: ticket.status,
        diagnosis_notes: ticket.diagnosis_notes,
        technician_notes: ticket.technician_notes,
        final_cost: ticket.final_cost ? Number(ticket.final_cost) : undefined,
      }, token);
      setTicket(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPart = async () => {
    if (!token || !newPart.name.trim() || !newPart.unit_cost) return;
    try {
      const updated = await repairsApi.addPart(id, {
        name: newPart.name.trim(),
        quantity: parseInt(newPart.quantity, 10) || 1,
        unit_cost: newPart.unit_cost,
      }, token);
      setTicket(updated);
      setNewPart({ name: '', quantity: '1', unit_cost: '' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo agregar el repuesto.');
    }
  };

  const handleUploadImage = async (file: File) => {
    if (!token) return;
    setUploading(true);
    try {
      const updated = await repairsApi.addImage(id, file, '', token);
      setTicket(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}><Loader2 size={24} className="spin" /></div>;
  if (error && !ticket) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}><PackageX size={28} /><p>{error}</p></div>;
  if (!ticket) return null;

  return (
    <div>
      <button className={styles.back} onClick={() => router.push('/panel/tecnicos')}>
        <ArrowLeft size={15} /> Volver a reparaciones
      </button>

      <div className={styles.headRow}>
        <span className={styles.ticketNum}>{ticket.ticket_number}</span>
        {canAssign && (
          <button className={styles.assignBtn} onClick={() => setShowAssign(true)}>
            <UserCog size={14} /> {ticket.technician ? 'Reasignar técnico' : 'Asignar técnico'}
          </button>
        )}
      </div>
      <p className={styles.subtitle}>{ticket.device_type} {ticket.device_brand} {ticket.device_model} — {ticket.customer_name}</p>

      {isReadOnly && (
        <div className={styles.readOnlyNote}>
          <Eye size={14} /> Estás viendo este ticket en modo consulta (rol Supervisor) — no puedes editarlo.
        </div>
      )}

      <div className={styles.grid}>
        <div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Información del cliente</div>
            <div className={styles.infoRow}><span>Cliente</span><span>{ticket.customer_name}</span></div>
            <div className={styles.infoRow}><span>Teléfono</span><span>{ticket.customer_phone}</span></div>
            <div className={styles.infoRow}><span>Técnico asignado</span><span>{ticket.technician_name}</span></div>
            <div className={styles.infoRow}><span>Serial</span><span>{ticket.serial_number || '—'}</span></div>
            <div className={styles.infoRow}><span>Problema reportado</span><span>{ticket.reported_issue}</span></div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Repuestos utilizados</div>
            <div className={styles.partsList}>
              {ticket.parts.map((p) => (
                <div key={p.id} className={styles.partRow}>
                  <span>{p.quantity}x {p.name}</span>
                  <span>{currency.format(Number(p.subtotal))}</span>
                </div>
              ))}
              {ticket.parts.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sin repuestos registrados.</p>}
            </div>
            {canEdit && (
              <div className={styles.addPartRow}>
                <input placeholder="Nombre" value={newPart.name} onChange={(e) => setNewPart((p) => ({ ...p, name: e.target.value }))} />
                <input type="number" min="1" placeholder="Cant." value={newPart.quantity} onChange={(e) => setNewPart((p) => ({ ...p, quantity: e.target.value }))} />
                <input type="number" min="0" step="0.01" placeholder="Costo" value={newPart.unit_cost} onChange={(e) => setNewPart((p) => ({ ...p, unit_cost: e.target.value }))} />
                <button className={styles.addPartBtn} onClick={handleAddPart}>+</button>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Estado y notas</div>
            <div className={styles.field}>
              <label>Estado</label>
              <select
                value={ticket.status}
                disabled={!canEdit}
                onChange={(e) => setTicket({ ...ticket, status: e.target.value })}
              >
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>Notas de diagnóstico</label>
              <textarea rows={3} disabled={!canEdit} value={ticket.diagnosis_notes}
                onChange={(e) => setTicket({ ...ticket, diagnosis_notes: e.target.value })} />
            </div>
            <div className={styles.field}>
              <label>Notas técnicas</label>
              <textarea rows={3} disabled={!canEdit} value={ticket.technician_notes}
                onChange={(e) => setTicket({ ...ticket, technician_notes: e.target.value })} />
            </div>
            <div className={styles.field}>
              <label>Costo final</label>
              <input type="number" min="0" step="0.01" disabled={!canEdit} value={ticket.final_cost ?? ''}
                onChange={(e) => setTicket({ ...ticket, final_cost: e.target.value })} />
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{error}</p>}
            {canEdit && (
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Guardar cambios
              </button>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Fotos del equipo</div>
            <div className={styles.imagesGrid}>
              {ticket.images.map((img) => (
                <div key={img.id} className={styles.imageSlot}>
                  <Image
                    src={img.image}
                    alt={img.caption || ticket.ticket_number}
                    fill
                    sizes="150px"
                    style={{ objectFit: 'cover' }}
                  />
                </div>
              ))}
              {canEdit && (
                <div className={styles.uploadSlot} onClick={() => !uploading && fileInputRef.current?.click()}>
                  {uploading ? <Loader2 size={18} className="spin" /> : <ImagePlus size={18} />}
                  <span>Subir foto</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadImage(f); e.target.value = ''; }}
            />
          </div>
        </div>
      </div>

      {showAssign && token && (
        <AssignTechnicianModal
          ticketId={id}
          token={token}
          onClose={() => setShowAssign(false)}
          onAssigned={(updated) => { setTicket(updated); setShowAssign(false); }}
        />
      )}
    </div>
  );
}

function AssignTechnicianModal({ ticketId, token, onClose, onAssigned }: {
  ticketId: string; token: string; onClose: () => void; onAssigned: (t: RepairTicket) => void;
}) {
  const [tecnicos, setTecnicos] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    repairsApi.tecnicosDisponibles(token)
      .then(setTecnicos)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los técnicos.'))
      .finally(() => setLoading(false));
  }, [token]);

  const assign = async (technicianId: string) => {
    try {
      const updated = await repairsApi.assignTechnician(ticketId, technicianId, token);
      onAssigned(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo asignar.');
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3>Asignar técnico</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        {loading && <Loader2 size={18} className="spin" />}
        {error && <p style={{ color: '#ef4444', fontSize: 12 }}>{error}</p>}
        {!loading && tecnicos.map((t) => (
          <div key={t.id} className={styles.techOption} onClick={() => assign(t.id)}>
            <span>{t.full_name}</span>
          </div>
        ))}
        {!loading && tecnicos.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>No hay técnicos activos.</p>}
      </div>
    </div>
  );
}
