'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { authApi, ApiError } from '@/lib/api';
import styles from './LoginModal.module.css';

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.6 0-14.1 4.3-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.4-2 14.1-5.4l-6.5-5.5C29.4 34.9 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.8 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.8l6.5 5.5C39.9 37.4 44 31.5 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [regForm, setRegForm] = useState({
    first_name: '', last_name: '', email: '', password: '', password_confirm: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn('credentials', {
      email: loginForm.email,
      password: loginForm.password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError('Credenciales inválidas. Verifica tu correo y contraseña.');
      return;
    }
    onClose();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authApi.register(regForm);
      // Cuenta creada — iniciamos sesión con las mismas credenciales vía NextAuth
      const result = await signIn('credentials', {
        email: regForm.email,
        password: regForm.password,
        redirect: false,
      });
      if (result?.error) {
        setError('Cuenta creada, pero no se pudo iniciar sesión automáticamente. Intenta ingresar.');
        setTab('login');
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className={`${styles.overlay} ${open ? styles.on : ''}`} onClick={onClose}>
      <div className={styles.box} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
          <X size={16} />
        </button>

        <div className={styles.head}>
          <h2>Accede a tu cuenta</h2>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'login' ? styles.on : ''}`}
            onClick={() => { setTab('login'); setError(null); }}
          >
            Iniciar sesión
          </button>
          <button
            className={`${styles.tab} ${tab === 'register' ? styles.on : ''}`}
            onClick={() => { setTab('register'); setError(null); }}
          >
            Crear cuenta
          </button>
        </div>

        {error && (
          <div className={styles.error}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {tab === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className={styles.field}>
              <label htmlFor="login-email">Correo electrónico</label>
              <input
                id="login-email"
                type="email"
                required
                value={loginForm.email}
                onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="login-password">Contraseña</label>
              <input
                id="login-password"
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <button className={styles.submitBtn} type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="spin" /> : 'Iniciar sesión'}
            </button>

            <div className={styles.divider}>o continúa con</div>
            <button
              type="button"
              className={styles.googleBtn}
              onClick={() => signIn('google', { callbackUrl: window.location.href })}
            >
              <GoogleIcon /> Continuar con Google
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label htmlFor="reg-fname">Nombre</label>
                <input
                  id="reg-fname"
                  required
                  value={regForm.first_name}
                  onChange={(e) => setRegForm((f) => ({ ...f, first_name: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="reg-lname">Apellido</label>
                <input
                  id="reg-lname"
                  required
                  value={regForm.last_name}
                  onChange={(e) => setRegForm((f) => ({ ...f, last_name: e.target.value }))}
                />
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="reg-email">Correo electrónico</label>
              <input
                id="reg-email"
                type="email"
                required
                value={regForm.email}
                onChange={(e) => setRegForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="reg-password">Contraseña</label>
              <input
                id="reg-password"
                type="password"
                required
                minLength={12}
                value={regForm.password}
                onChange={(e) => setRegForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="reg-password-confirm">Confirmar contraseña</label>
              <input
                id="reg-password-confirm"
                type="password"
                required
                value={regForm.password_confirm}
                onChange={(e) => setRegForm((f) => ({ ...f, password_confirm: e.target.value }))}
              />
            </div>
            <button className={styles.submitBtn} type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="spin" /> : 'Crear cuenta'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
