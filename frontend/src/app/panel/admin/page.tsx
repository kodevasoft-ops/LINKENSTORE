'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Search, ShoppingCart, Users, TrendingUp, RefreshCw, BarChart3 } from 'lucide-react';
import PanelLayout from '@/components/layout/PanelLayout';
import { KpiSkeleton } from '@/components/ui/Skeletons';
import api from '@/lib/api';

const fetcher = (url: string) => api.get(url).then(r => r.data);

const TOOLTIP = {
  contentStyle: { background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 10, fontSize: 12 },
  labelStyle:   { color: '#94a3b8' },
  itemStyle:    { color: '#f1f5f9' },
};

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#22d3ee','#8b5cf6'];

// ── Module 1: Search traffic ─────────────────────────────────────────────────
function SearchModule({ days }: { days: number }) {
  const { data, isLoading } = useSWR<any>(
    `/api/v1/analytics/search-traffic/?period=${days}d&limit=15`, fetcher, { refreshInterval: 60000 }
  );

  const hourly     = data?.hourly ?? [];
  const topQueries = data?.top_queries?.slice(0, 8) ?? [];
  const zeroRes    = data?.zero_results?.slice(0, 8) ?? [];
  const totalSearches  = topQueries.reduce((a: number, q: any) => a + q.count, 0);
  const uniqueSearchers = Math.max(...hourly.map((h: any) => h.unique), 0);
  const zeroTotal  = zeroRes.reduce((a: number, q: any) => a + q.count, 0);

  const dailyMap = new Map<string, number>();
  hourly.forEach((h: any) => {
    const day = h.hour?.slice(0, 10);
    if (day) dailyMap.set(day, (dailyMap.get(day) ?? 0) + h.count);
  });
  const chartData = Array.from(dailyMap.entries()).slice(-30).map(([date, count]) => ({ date: date.slice(5), count }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
        {[
          { label: 'Búsquedas', value: totalSearches.toLocaleString(),   icon: <Search size={18} />,      color: 'var(--primary)' },
          { label: 'Buscadores únicos', value: uniqueSearchers.toLocaleString(), icon: <Users size={18} />,  color: 'var(--success)' },
          { label: 'Sin resultados', value: zeroTotal.toLocaleString(),   icon: <TrendingUp size={18} />,  color: 'var(--danger)' },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p className="kpi-label">{k.label}</p>
              <span style={{ color: k.color }}>{k.icon}</span>
            </div>
            {isLoading ? <div className="skeleton" style={{ height: 32, borderRadius: 6, width: '60%' }} /> : <p className="kpi-value">{k.value}</p>}
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ padding: 20 }}>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16, fontWeight: 600 }}>Búsquedas por día</p>
        {isLoading ? <div className="skeleton" style={{ height: 180, borderRadius: 10 }} /> : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip {...TOOLTIP} />
              <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#sg)" strokeWidth={2} name="Búsquedas" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {topQueries.length > 0 && (
          <div className="glass-card" style={{ padding: 20 }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 14, fontWeight: 600 }}>Top queries</p>
            {topQueries.map((q: any, i: number) => (
              <div key={q.query} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: 18, textAlign: 'right', flexShrink: 0 }}>{i+1}</span>
                <div style={{ flex: 1, height: 24, background: 'var(--bg-secondary)', borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: 'rgba(99,102,241,0.25)', borderRadius: 99, width: `${(q.count / (topQueries[0]?.count || 1)) * 100}%` }} />
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{q.query}</span>
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 700, flexShrink: 0 }}>{q.count}</span>
              </div>
            ))}
          </div>
        )}
        {zeroRes.length > 0 && (
          <div className="glass-card" style={{ padding: 20 }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 14, fontWeight: 600 }}>Sin resultados (oportunidades)</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {zeroRes.map((q: any) => (
                <span key={q.query} style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: 99, background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }}>
                  "{q.query}" ×{q.count}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Module 2: Cart capture ────────────────────────────────────────────────────
function CartModule({ days }: { days: number }) {
  const { data, isLoading } = useSWR<any>(`/api/v1/analytics/daily-summary/?days=${days}`, fetcher, { refreshInterval: 60000 });
  const summaries = (data?.results ?? []).slice().reverse();
  const totCreated   = summaries.reduce((a: number, d: any) => a + (d.carts_created   ?? 0), 0);
  const totCompleted = summaries.reduce((a: number, d: any) => a + (d.carts_completed ?? 0), 0);
  const totAbandoned = summaries.reduce((a: number, d: any) => a + (d.carts_abandoned ?? 0), 0);
  const convRate     = totCreated > 0 ? ((totCompleted / totCreated) * 100).toFixed(1) : '0';
  const pieData = [
    { name: 'Completados', value: totCompleted },
    { name: 'Abandonados', value: totAbandoned },
    { name: 'En progreso', value: Math.max(0, totCreated - totCompleted - totAbandoned) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
        {[
          { label: 'Carritos creados',  value: totCreated.toLocaleString(),   color: 'var(--primary)' },
          { label: 'Completados',       value: totCompleted.toLocaleString(),  color: 'var(--success)' },
          { label: 'Abandonados',       value: totAbandoned.toLocaleString(),  color: 'var(--danger)' },
          { label: 'Tasa conversión',   value: `${convRate}%`,                 color: 'var(--warning)' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <p className="kpi-label">{k.label}</p>
            {isLoading ? <div className="skeleton" style={{ height: 32, borderRadius: 6, marginTop: 8, width: '60%' }} /> : <p className="kpi-value" style={{ color: k.color }}>{k.value}</p>}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="glass-card" style={{ padding: 20 }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16, fontWeight: 600 }}>Carritos por día</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={summaries} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="carts_created"   name="Creados"    fill="#6366f1" radius={[3,3,0,0]} />
              <Bar dataKey="carts_completed" name="Completados" fill="#10b981" radius={[3,3,0,0]} />
              <Bar dataKey="carts_abandoned" name="Abandonados" fill="#ef4444" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card" style={{ padding: 20 }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16, fontWeight: 600 }}>Distribución</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip {...TOOLTIP} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Module 3: New customers ───────────────────────────────────────────────────
function CustomersModule({ days }: { days: number }) {
  const { data: custData } = useSWR<any>(`/api/v1/analytics/new-customers/?days=${days}`, fetcher, { refreshInterval: 60000 });
  const { data: summData } = useSWR<any>(`/api/v1/analytics/daily-summary/?days=${days}`, fetcher);
  const summaries  = (summData?.results ?? []).slice().reverse();
  const totalNew   = custData?.total ?? 0;
  const bySource   = custData?.by_source ?? {};
  const sourcePie  = Object.entries(bySource).map(([name, value]) => ({ name, value }));
  const LABELS: Record<string, string> = { organic:'Orgánico', referral:'Referido', direct:'Directo', social:'Redes', email:'Email', paid:'Publicidad' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
        <div className="kpi-card"><p className="kpi-label">Nuevos clientes</p><p className="kpi-value" style={{ color: 'var(--success)' }}>{totalNew.toLocaleString()}</p></div>
        <div className="kpi-card"><p className="kpi-label">Promedio/día</p><p className="kpi-value">{(totalNew / Math.max(days, 1)).toFixed(1)}</p></div>
        <div className="kpi-card"><p className="kpi-label">Fuente principal</p><p className="kpi-value" style={{ fontSize: '1.1rem' }}>{LABELS[Object.entries(bySource).sort((a,b)=>(b[1] as number)-(a[1] as number))[0]?.[0]??'']??'—'}</p></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="glass-card" style={{ padding: 20 }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16, fontWeight: 600 }}>Registros por día</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={summaries}>
              <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.25} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip {...TOOLTIP} />
              <Area type="monotone" dataKey="new_customers" stroke="#10b981" fill="url(#cg)" strokeWidth={2} name="Nuevos" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card" style={{ padding: 20 }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16, fontWeight: 600 }}>Fuentes</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={sourcePie} cx="50%" cy="50%" outerRadius={68} dataKey="value" nameKey="name">
                {sourcePie.map((_,i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip {...TOOLTIP} formatter={(v,n) => [v, LABELS[String(n)] ?? n]} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} formatter={(n: string) => LABELS[n] ?? n} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Module 4: Cart abandonment ────────────────────────────────────────────────
function AbandonmentModule() {
  const { data, isLoading } = useSWR<any>('/api/v1/analytics/abandonments/?limit=20', fetcher, { refreshInterval: 120000 });
  const stats   = data?.stats ?? {};
  const records = data?.results ?? [];

  const STATUS: Record<string, { color: string; label: string }> = {
    abandoned: { color: '#f87171', label: 'Abandonado' },
    recovered: { color: '#34d399', label: 'Recuperado' },
    expired:   { color: '#64748b', label: 'Expirado' },
  };
  const STEP: Record<string, string> = { cart: 'Vio carrito', address: 'En dirección', payment: 'En pago' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
        {[
          { label: 'Total abandonos', value: stats.total?.toLocaleString() ?? '—',      color: 'var(--danger)' },
          { label: 'Recuperados',     value: stats.recovered?.toLocaleString() ?? '—',  color: 'var(--success)' },
          { label: 'Tasa recuperación', value: stats.rate ?? '—',                        color: 'var(--warning)' },
          { label: 'Valor promedio',  value: stats.avg_value ? `$${Number(stats.avg_value).toLocaleString('es-CO')}` : '—', color: 'var(--primary)' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <p className="kpi-label">{k.label}</p>
            <p className="kpi-value" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Abandonos recientes</p>
        </div>
        {isLoading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 42, borderRadius: 8 }} />)}
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Sin datos</div>
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  {['Total','Items','Último paso','Estado','Email recup.','Fecha'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r: any) => {
                  const s = STATUS[r.status] ?? STATUS.abandoned;
                  return (
                    <tr key={r.id}>
                      <td className="text-main" style={{ fontVariantNumeric: 'tabular-nums' }}>${Number(r.cart_total).toLocaleString('es-CO')}</td>
                      <td>{r.items_count}</td>
                      <td>{STEP[r.last_step] ?? r.last_step}</td>
                      <td><span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: `${s.color}18`, color: s.color }}>{s.label}</span></td>
                      <td>{r.recovery_email_sent ? <span style={{ color: 'var(--success)', fontSize: '0.8rem' }}>Enviado</span> : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No</span>}</td>
                      <td style={{ fontSize: '0.78rem' }}>{new Date(r.abandoned_at).toLocaleDateString('es-CO')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
type TabKey = 'search' | 'cart' | 'customers' | 'abandonment';

export default function AdminDashboard() {
  const [tab,  setTab]  = useState<TabKey>('search');
  const [days, setDays] = useState(30);

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'search',      label: 'Búsqueda',          icon: <Search      size={15} /> },
    { key: 'cart',        label: 'Carrito',            icon: <ShoppingCart size={15} /> },
    { key: 'customers',   label: 'Clientes',           icon: <Users       size={15} /> },
    { key: 'abandonment', label: 'Abandono',           icon: <TrendingUp  size={15} /> },
  ];

  return (
    <PanelLayout title="Analytics" subtitle="Dashboard de analíticas" allowedRoles={['admin','superadmin']}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 3, gap: 2 }}>
            {[7,14,30,90].map(d => (
              <button key={d} onClick={() => setDays(d)} className={`btn btn-sm ${days===d?'btn-primary':'btn-ghost'}`} style={{ padding: '4px 10px', fontSize: '0.78rem' }}>{d}d</button>
            ))}
          </div>
          <RefreshCw size={16} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
        </div>
      }
    >
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

      {tab === 'search'      && <SearchModule      days={days} />}
      {tab === 'cart'        && <CartModule         days={days} />}
      {tab === 'customers'   && <CustomersModule    days={days} />}
      {tab === 'abandonment' && <AbandonmentModule />}
    </PanelLayout>
  );
}
