'use client';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import api from '@/lib/api';

const schema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});

const ROLE_PATHS: Record<string, string> = {
  superadmin: '/panel/superadmin',
  admin:      '/panel/admin',
  advisor:    '/panel/advisor',
  technician: '/panel/technician',
  customer:   '/',
};

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const nextUrl      = searchParams.get('next');

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [loading,  setLoading]  = useState(false);

  const validate = () => {
    const r = schema.safeParse({ email, password });
    if (!r.success) {
      const errs: Record<string, string> = {};
      r.error.errors.forEach(e => { if (!errs[e.path[0]]) errs[e.path[0] as string] = e.message; });
      setErrors(errs); return false;
    }
    setErrors({}); return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true); setApiError('');
    try {
      const res = await signIn('credentials', { email, password, redirect: false });
      if (res?.error) { setApiError(res.error); return; }
      const { data: me } = await api.get('/api/v1/auth/me/');
      router.push(nextUrl || ROLE_PATHS[me.role] || '/');
    } catch { setApiError('Error al iniciar sesión. Intenta de nuevo.'); }
    finally { setLoading(false); }
  };

  const inputStyle = (field: string) => ({
    width: '100%', background: 'var(--bg-input)',
    border: `1px solid ${errors[field] ? 'var(--danger)' : 'var(--border)'}`,
    borderRadius: 10, padding: '11px 14px', fontSize: '0.875rem',
    color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <h1 style={{ fontFamily: 'var(--font-jakarta)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              kata<span style={{ color: 'var(--primary)' }}>log</span>
            </h1>
          </Link>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 6 }}>Inicia sesión en tu cuenta</p>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Email */}
            <div>
              <label className="input-label">Correo electrónico</label>
              <input type="email" autoComplete="email" autoFocus value={email}
                onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })); setApiError(''); }}
                placeholder="correo@empresa.com"
                style={inputStyle('email') as React.CSSProperties}
                onFocus={e => (e.target.style.borderColor = errors.email ? 'var(--danger)' : 'var(--primary)')}
                onBlur={e  => (e.target.style.borderColor = errors.email ? 'var(--danger)' : 'var(--border)')}
              />
              {errors.email && <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: 4 }}>{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="input-label">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} autoComplete="current-password" value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); setApiError(''); }}
                  placeholder="••••••••••••"
                  style={{ ...inputStyle('password') as React.CSSProperties, paddingRight: 44 }}
                  onFocus={e => (e.target.style.borderColor = errors.password ? 'var(--danger)' : 'var(--primary)')}
                  onBlur={e  => (e.target.style.borderColor = errors.password ? 'var(--danger)' : 'var(--border)')}
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: 4 }}>{errors.password}</p>}
            </div>

            {/* API Error */}
            {apiError && (
              <div className="alert alert-error" style={{ fontSize: '0.82rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                {apiError}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} className="btn btn-primary btn-full btn-lg">
              {loading
                ? <><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} /> Ingresando…</>
                : <><LogIn size={16} /> Iniciar sesión</>
              }
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              No tienes cuenta?{' '}
              <Link href="/auth/register" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                Regístrate
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} />}><LoginForm /></Suspense>;
}
