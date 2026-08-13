'use client';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
import api from '@/lib/api';
import { useAuthStore } from '@/store';

const schema = z.object({
  first_name:       z.string().min(2, 'Mínimo 2 caracteres'),
  last_name:        z.string().min(2, 'Mínimo 2 caracteres'),
  email:            z.string().email('Email inválido'),
  password:         z.string()
    .min(12,  'Mínimo 12 caracteres')
    .regex(/[A-Z]/,       'Debe incluir mayúscula')
    .regex(/[a-z]/,       'Debe incluir minúscula')
    .regex(/\d/,          'Debe incluir número')
    .regex(/[^A-Za-z0-9]/,'Debe incluir símbolo'),
  password_confirm: z.string(),
}).refine(d => d.password === d.password_confirm, { message: 'Las contraseñas no coinciden', path: ['password_confirm'] });

type FormData = z.infer<typeof schema>;

const REQ = [
  { test: (p: string) => p.length >= 12,          label: '12+ caracteres' },
  { test: (p: string) => /[A-Z]/.test(p),         label: 'Mayúscula' },
  { test: (p: string) => /[a-z]/.test(p),         label: 'Minúscula' },
  { test: (p: string) => /\d/.test(p),            label: 'Número' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: 'Símbolo' },
];

function RegisterForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { setToken } = useAuthStore();

  const [form,     setForm]     = useState<Partial<FormData>>({});
  const [errors,   setErrors]   = useState<Partial<Record<keyof FormData, string>>>({});
  const [apiError, setApiError] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const pwd = form.password ?? '';

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, [k]: e.target.value }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: undefined }));
    setApiError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(form);
    if (!r.success) {
      const errs: Partial<Record<keyof FormData, string>> = {};
      r.error.errors.forEach(e => { const k = e.path[0] as keyof FormData; if (!errs[k]) errs[k] = e.message; });
      setErrors(errs); return;
    }
    setLoading(true); setApiError('');
    try {
      const { data } = await api.post('/api/v1/auth/register/', {
        ...r.data,
        utm_source:   searchParams.get('utm_source')   ?? '',
        utm_medium:   searchParams.get('utm_medium')   ?? '',
        utm_campaign: searchParams.get('utm_campaign') ?? '',
        referrer:     typeof document !== 'undefined' ? document.referrer : '',
      });
      setToken(data.access, data.refresh, data.user);
      router.push('/');
    } catch (err: any) {
      const d = err?.response?.data;
      if (d && typeof d === 'object') {
        const errs: Partial<Record<keyof FormData, string>> = {};
        Object.entries(d).forEach(([k, v]) => { errs[k as keyof FormData] = Array.isArray(v) ? (v[0] as string) : String(v); });
        setErrors(errs);
      } else { setApiError('Error al crear la cuenta.'); }
    } finally { setLoading(false); }
  };

  const inputSt = (k: keyof FormData): React.CSSProperties => ({
    width: '100%', background: 'var(--bg-input)',
    border: `1px solid ${errors[k] ? 'var(--danger)' : 'var(--border)'}`,
    borderRadius: 10, padding: '11px 14px', fontSize: '0.875rem',
    color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <h1 style={{ fontFamily: 'var(--font-jakarta)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              kata<span style={{ color: 'var(--primary)' }}>log</span>
            </h1>
          </Link>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 6 }}>Crea tu cuenta gratis</p>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Name row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="input-label">Nombre</label>
                <input type="text" autoComplete="given-name" placeholder="Juan" onChange={set('first_name')} style={inputSt('first_name')} />
                {errors.first_name && <p style={{ fontSize: '0.72rem', color: 'var(--danger)', marginTop: 3 }}>{errors.first_name}</p>}
              </div>
              <div>
                <label className="input-label">Apellido</label>
                <input type="text" autoComplete="family-name" placeholder="Pérez" onChange={set('last_name')} style={inputSt('last_name')} />
                {errors.last_name && <p style={{ fontSize: '0.72rem', color: 'var(--danger)', marginTop: 3 }}>{errors.last_name}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="input-label">Correo electrónico</label>
              <input type="email" autoComplete="email" placeholder="correo@empresa.com" onChange={set('email')} style={inputSt('email')} />
              {errors.email && <p style={{ fontSize: '0.72rem', color: 'var(--danger)', marginTop: 3 }}>{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="input-label">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} autoComplete="new-password" placeholder="Mínimo 12 caracteres"
                  onChange={set('password')} style={{ ...inputSt('password'), paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Requirements */}
              {pwd && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', marginTop: 8 }}>
                  {REQ.map(r => (
                    <span key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: r.test(pwd) ? 'var(--success)' : 'var(--text-muted)' }}>
                      <CheckCircle2 size={12} />  {r.label}
                    </span>
                  ))}
                </div>
              )}
              {errors.password && <p style={{ fontSize: '0.72rem', color: 'var(--danger)', marginTop: 3 }}>{errors.password}</p>}
            </div>

            {/* Confirm */}
            <div>
              <label className="input-label">Confirmar contraseña</label>
              <input type={showPass ? 'text' : 'password'} autoComplete="new-password" placeholder="Repite tu contraseña"
                onChange={set('password_confirm')} style={inputSt('password_confirm')} />
              {errors.password_confirm && <p style={{ fontSize: '0.72rem', color: 'var(--danger)', marginTop: 3 }}>{errors.password_confirm}</p>}
            </div>

            {apiError && (
              <div className="alert alert-error" style={{ fontSize: '0.82rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} /> {apiError}
              </div>
            )}

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Al registrarte aceptas nuestros{' '}
              <Link href="/terminos" style={{ color: 'var(--primary)' }}>Términos</Link>{' '}y{' '}
              <Link href="/privacidad" style={{ color: 'var(--primary)' }}>Política de privacidad</Link>.
            </p>

            <button type="submit" disabled={loading} className="btn btn-primary btn-full btn-lg">
              {loading
                ? <><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} /> Creando cuenta…</>
                : <><UserPlus size={16} /> Crear cuenta gratis</>
              }
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 20 }}>
            Ya tienes cuenta?{' '}
            <Link href="/auth/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} />}><RegisterForm /></Suspense>;
}
