'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { Users, Package, Settings, Shield, RefreshCw, Plus, ToggleLeft, ToggleRight, Database, TrendingUp, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import PanelLayout from '@/components/layout/PanelLayout';
import Modal from '@/components/ui/Modal';
import { TableRowSkeleton, KpiSkeleton } from '@/components/ui/Skeletons';
import api from '@/lib/api';

const fetcher = (url: string) => api.get(url).then(r => r.data);

// ── Users tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const [creating,   setCreating]   = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [newUser,    setNewUser]    = useState({ email: '', first_name: '', last_name: '', role: 'advisor', password: '' });

  const { data, isLoading, mutate } = useSWR<any[]>(
    `/api/v1/superadmin/users/${roleFilter ? `?role=${roleFilter}` : ''}`, fetcher
  );
  const users = data ?? [];

  const createUser = async () => {
    if (!newUser.email || !newUser.password) { toast.error('Email y contraseña requeridos'); return; }
    try {
      await api.post('/api/v1/superadmin/users/', newUser);
      toast.success('Usuario creado'); setCreating(false);
      setNewUser({ email: '', first_name: '', last_name: '', role: 'advisor', password: '' });
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al crear usuario');
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await api.patch(`/api/v1/superadmin/users/${id}/toggle-active/`, {});
      toast.success(current ? 'Usuario desactivado' : 'Usuario activado');
      mutate();
    } catch { toast.error('Error'); }
  };

  const ROLE_LABELS: Record<string, string> = { customer:'Cliente', advisor:'Asesor', technician:'Técnico', admin:'Admin', superadmin:'SuperAdmin' };
  const ROLE_COLORS: Record<string, string> = { customer:'var(--text-muted)', advisor:'var(--primary)', technician:'var(--warning)', admin:'var(--accent)', superadmin:'var(--success)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['', 'advisor', 'technician', 'admin'].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`btn btn-sm ${roleFilter === r ? 'btn-primary' : 'btn-secondary'}`}>
              {r ? ROLE_LABELS[r] : 'Todos'}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)} style={{ gap: 6 }}>
          <Plus size={14} /> Nuevo usuario
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>{['Nombre','Email','Rol','Estado','Registrado','Acción'].map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
              : users.map((u: any) => (
                  <tr key={u.id}>
                    <td className="text-main">{u.first_name} {u.last_name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{u.email}</td>
                    <td><span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: `${ROLE_COLORS[u.role]}15`, color: ROLE_COLORS[u.role] }}>{ROLE_LABELS[u.role] ?? u.role}</span></td>
                    <td><span style={{ fontSize: '0.75rem', color: u.is_active ? 'var(--success)' : 'var(--danger)' }}>{u.is_active ? 'Activo' : 'Inactivo'}</span></td>
                    <td style={{ fontSize: '0.78rem' }}>{new Date(u.created_at).toLocaleDateString('es-CO')}</td>
                    <td>
                      <button className="btn btn-ghost btn-icon" onClick={() => toggleActive(u.id, u.is_active)} title={u.is_active ? 'Desactivar' : 'Activar'}>
                        {u.is_active ? <ToggleRight size={18} color="var(--success)" /> : <ToggleLeft size={18} color="var(--danger)" />}
                      </button>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Crear usuario interno"
        footer={<><button className="btn btn-secondary" onClick={() => setCreating(false)}>Cancelar</button><button className="btn btn-primary" onClick={createUser} style={{ gap: 6 }}><Plus size={14} /> Crear</button></>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="input-label">Nombre</label><input className="input" value={newUser.first_name} onChange={e => setNewUser(p => ({ ...p, first_name: e.target.value }))} /></div>
            <div><label className="input-label">Apellido</label><input className="input" value={newUser.last_name} onChange={e => setNewUser(p => ({ ...p, last_name: e.target.value }))} /></div>
          </div>
          <div><label className="input-label">Email</label><input type="email" className="input" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} /></div>
          <div><label className="input-label">Rol</label>
            <select className="input" value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
              {['advisor','technician','admin'].map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div><label className="input-label">Contraseña temporal</label><input type="password" className="input" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} placeholder="Mínimo 12 caracteres" /></div>
        </div>
      </Modal>
    </div>
  );
}

// ── Dashboard tab ──────────────────────────────────────────────────────────────
function DashboardTab() {
  const { data, isLoading } = useSWR<any>('/api/v1/superadmin/dashboard/', fetcher, { refreshInterval: 30000 });

  const KPIS = [
    { label: 'Usuarios totales',     value: data?.users_total,              color: 'var(--primary)',  icon: <Users size={18} /> },
    { label: 'Productos activos',    value: data?.products_total,           color: 'var(--accent)',   icon: <Package size={18} /> },
    { label: 'Stock bajo',           value: data?.products_low_stock,       color: 'var(--warning)',  icon: <TrendingUp size={18} /> },
    { label: 'Sin stock',            value: data?.products_out_stock,       color: 'var(--danger)',   icon: <Package size={18} /> },
    { label: 'Órdenes sin confirmar',value: data?.orders_pending_confirm,   color: 'var(--warning)',  icon: <Database size={18} /> },
    { label: 'Reparaciones activas', value: data?.repairs_active,           color: 'var(--success)',  icon: <Wrench size={18} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
        {isLoading ? Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />) : KPIS.map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p className="kpi-label">{k.label}</p>
              <span style={{ color: k.color }}>{k.icon}</span>
            </div>
            <p className="kpi-value" style={{ color: k.color }}>{k.value ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* Users by role */}
      {data?.users_by_role && (
        <div className="glass-card" style={{ padding: 20 }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Usuarios por rol</p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {Object.entries(data.users_by_role).map(([role, count]) => (
              <div key={role} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{String(count)}</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{role}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Config tab ────────────────────────────────────────────────────────────────
function ConfigTab() {
  const { data, mutate } = useSWR<any>('/api/v1/superadmin/config/', fetcher);
  const [form, setForm] = useState({ site_name: '', support_email: '', maintenance_mode: false });
  const [saving, setSaving] = useState(false);

  const cfg = data ?? form;

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/api/v1/superadmin/config/', { site_name: cfg.site_name, support_email: cfg.support_email, maintenance_mode: cfg.maintenance_mode });
      toast.success('Configuración guardada'); mutate();
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  return (
    <div className="glass-card" style={{ padding: 24, maxWidth: 520 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="input-label">Nombre del sitio</label>
          <input className="input" defaultValue={cfg.site_name} onChange={e => setForm(p => ({ ...p, site_name: e.target.value }))} />
        </div>
        <div>
          <label className="input-label">Email de soporte</label>
          <input type="email" className="input" defaultValue={cfg.support_email} onChange={e => setForm(p => ({ ...p, support_email: e.target.value }))} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: 14, background: 'var(--bg-secondary)', borderRadius: 10 }}>
          <input type="checkbox" defaultChecked={cfg.maintenance_mode} onChange={e => setForm(p => ({ ...p, maintenance_mode: e.target.checked }))} style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Modo mantenimiento</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Muestra mensaje de mantenimiento a los clientes</p>
          </div>
        </label>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving} style={{ alignSelf: 'flex-start' }}>
          {saving ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}

// ── Audit tab ─────────────────────────────────────────────────────────────────
function AuditTab() {
  const { data, isLoading } = useSWR<any[]>('/api/v1/superadmin/audit-logs/', fetcher, { refreshInterval: 30000 });
  const logs = data ?? [];

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>{['Usuario','Acción','IP','Fecha'].map(h => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {isLoading ? Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={4} />) :
            logs.map((log: any) => (
              <tr key={log.id}>
                <td className="text-main" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{log.user_email || '—'}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent)' }}>{log.action}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{log.ip_address || '—'}</td>
                <td style={{ fontSize: '0.78rem' }}>{new Date(log.created_at).toLocaleString('es-CO')}</td>
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}

// ── TNS tab ───────────────────────────────────────────────────────────────────
function TNSTab() {
  const { data, isLoading, mutate } = useSWR<any>('/api/v1/superadmin/tns-sync/', fetcher, { refreshInterval: 30000 });
  const [syncing, setSyncing] = useState(false);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      await api.post('/api/v1/areas/sync-tns/', {});
      toast.success('Sincronización iniciada'); mutate();
    } catch { toast.error('Error al iniciar sincronización'); }
    finally { setSyncing(false); }
  };

  const last = data?.last_sync;
  const STATUS_COLOR: Record<string, string> = { running:'var(--warning)', completed:'var(--success)', failed:'var(--danger)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
        <div className="kpi-card"><p className="kpi-label">Productos pendientes</p><p className="kpi-value" style={{ color: 'var(--warning)' }}>{data?.pending_products ?? '—'}</p></div>
        <div className="kpi-card"><p className="kpi-label">Productos con error</p><p className="kpi-value" style={{ color: 'var(--danger)' }}>{data?.error_products ?? '—'}</p></div>
      </div>

      {last && (
        <div className="glass-card" style={{ padding: 20 }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Última sincronización</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, fontSize: '0.85rem' }}>
            <div><p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: 4 }}>ESTADO</p><span style={{ fontWeight: 700, color: STATUS_COLOR[last.status] ?? 'var(--text-secondary)' }}>{last.status}</span></div>
            <div><p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: 4 }}>SINCRONIZADOS</p><span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{last.products_synced}</span></div>
            <div><p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: 4 }}>ERRORES</p><span style={{ color: last.errors_count > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 700 }}>{last.errors_count}</span></div>
            <div><p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: 4 }}>INICIADO</p><span style={{ color: 'var(--text-secondary)' }}>{new Date(last.started_at).toLocaleString('es-CO')}</span></div>
          </div>
        </div>
      )}

      <button className="btn btn-primary btn-sm" onClick={triggerSync} disabled={syncing} style={{ alignSelf: 'flex-start', gap: 6 }}>
        <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
type Tab = 'dashboard' | 'users' | 'config' | 'audit' | 'tns';

export default function SuperAdminPanel() {
  const [tab, setTab] = useState<Tab>('dashboard');

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'dashboard', label: 'Dashboard',   icon: <TrendingUp size={15} /> },
    { key: 'users',     label: 'Usuarios',    icon: <Users      size={15} /> },
    { key: 'tns',       label: 'TNS Sync',    icon: <Database   size={15} /> },
    { key: 'audit',     label: 'Auditoría',   icon: <Shield     size={15} /> },
    { key: 'config',    label: 'Config',      icon: <Settings   size={15} /> },
  ];

  return (
    <PanelLayout title="Super Admin" subtitle="Gestión completa del sistema" allowedRoles={['superadmin']}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 24, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${tab===t.key?'var(--primary)':'transparent'}`, cursor: 'pointer', fontSize: '0.875rem', fontWeight: tab===t.key?700:500, color: tab===t.key?'var(--primary)':'var(--text-muted)', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
            <span style={{ color: tab===t.key?'var(--primary)':'var(--text-muted)' }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'users'     && <UsersTab />}
      {tab === 'tns'       && <TNSTab />}
      {tab === 'audit'     && <AuditTab />}
      {tab === 'config'    && <ConfigTab />}
    </PanelLayout>
  );
}
