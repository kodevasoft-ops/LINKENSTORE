import { ShieldAlert } from 'lucide-react';

export default function NoAutorizadoPage() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <ShieldAlert size={40} color="var(--muted)" style={{ margin: '0 auto 16px' }} />
      <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>No tienes acceso a esta sección</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>
        Tu rol no tiene permisos para ver esta parte del panel.
      </p>
    </div>
  );
}
