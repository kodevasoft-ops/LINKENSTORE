'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar,
} from 'recharts';
import { TrendingUp, AlertTriangle, PackageX, Wrench, FileClock, Loader2 } from 'lucide-react';
import { analyticsApi, type SupervisorDashboard, ApiError } from '@/lib/api';
import styles from './Dashboard.module.css';

const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0, notation: 'compact' });
const currencyFull = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const ROLE_LABELS: Record<string, string> = {
  customer: 'Clientes', vendedor: 'Vendedores', administrador: 'Administradores',
  superadmin: 'SuperAdmins', tecnico: 'Técnicos', administrador_tecnico: 'Admin. Técnicos', supervisor: 'Supervisores',
};

export default function SupervisorDashboardPage() {
  const { data: session } = useSession();
  const token = (session as unknown as { accessToken?: string })?.accessToken;

  const [data, setData] = useState<SupervisorDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setData(await analyticsApi.supervisorDashboard(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el dashboard.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className={styles.empty}><Loader2 size={24} className="spin" /></div>;
  if (error || !data) return <div className={styles.empty}><PackageX size={28} /><p>{error}</p></div>;

  const trendData = data.ventas_trend_14d.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
  }));

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Dashboard</h1>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}><TrendingUp size={13} /> Ventas hoy</div>
          <div className={`${styles.kpiValue} ${styles.accent}`}>{currencyFull.format(data.revenue_hoy)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}><TrendingUp size={13} /> Ventas 30 días</div>
          <div className={styles.kpiValue}>{currencyFull.format(data.revenue_30d)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}><FileClock size={13} /> Pendientes TNS</div>
          <div className={`${styles.kpiValue} ${data.ordenes_pendientes_tns > 0 ? styles.warn : ''}`}>{data.ordenes_pendientes_tns}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}><AlertTriangle size={13} /> Stock bajo / agotado</div>
          <div className={`${styles.kpiValue} ${styles.danger}`}>{data.productos_stock_bajo + data.productos_sin_stock}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}><Wrench size={13} /> Reparaciones activas</div>
          <div className={styles.kpiValue}>{data.reparaciones_activas}</div>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Ventas — últimos 14 días</div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="ventasGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--y)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--y)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bdr2)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => currency.format(v)} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={60} />
              <Tooltip
                formatter={(value: number) => currencyFull.format(value)}
                contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--bdr2)', borderRadius: 10, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="total" stroke="var(--y)" strokeWidth={2} fill="url(#ventasGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelTitle}>Usuarios por rol</div>
          <div className={styles.roleGrid}>
            {Object.entries(data.users_by_role).map(([role, count]) => (
              <div key={role} className={styles.roleItem}>
                <div className={styles.roleCount}>{count}</div>
                <div className={styles.roleName}>{ROLE_LABELS[role] || role}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Ventas por punto</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.ventas_por_punto} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bdr2)" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => currency.format(v)} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="punto__name" tick={{ fontSize: 12, fill: 'var(--txt)' }} axisLine={false} tickLine={false} width={90} />
              <Tooltip
                formatter={(value: number) => currencyFull.format(value)}
                contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--bdr2)', borderRadius: 10, fontSize: 12 }}
              />
              <Bar dataKey="total" fill="var(--y)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelTitle}>Productos por punto</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.productos_por_punto} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bdr2)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="punto__name" tick={{ fontSize: 12, fill: 'var(--txt)' }} axisLine={false} tickLine={false} width={90} />
              <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--bdr2)', borderRadius: 10, fontSize: 12 }} />
              <Bar dataKey="total" fill="var(--muted)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
