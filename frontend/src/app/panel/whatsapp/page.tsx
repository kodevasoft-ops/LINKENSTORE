'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  MessageCircle, Loader2, PackageX, Save, Power, PowerOff, AlertTriangle, ShieldCheck,
} from 'lucide-react';
import { whatsappApi, type WhatsAppConfigData, ApiError } from '@/lib/api';
import styles from './WhatsApp.module.css';

export default function WhatsAppPanelPage() {
  const { data: session } = useSession();
  const token = (session as unknown as { accessToken?: string })?.accessToken;

  const [config, setConfig] = useState<WhatsAppConfigData | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setConfig(await whatsappApi.getConfig(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la configuración.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    if (!config || !token) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<WhatsAppConfigData> & { api_key?: string } = {
        respond_on_message: config.respond_on_message,
        cart_reminder_enabled: config.cart_reminder_enabled,
        cart_reminder_delay_minutes: config.cart_reminder_delay_minutes,
        followup_enabled: config.followup_enabled,
        followup_delay_hours: config.followup_delay_hours,
        order_confirmation_enabled: config.order_confirmation_enabled,
      };
      if (apiKeyInput.trim()) payload.api_key = apiKeyInput.trim();
      const updated = await whatsappApi.updateConfig(payload, token);
      setConfig(updated);
      setApiKeyInput('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!config || !token) return;
    if (!config.is_active && !config.has_api_key && !apiKeyInput.trim()) {
      setError('Ingresa tu D360-API-KEY antes de activar el módulo.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<WhatsAppConfigData> & { api_key?: string } = { is_active: !config.is_active };
      if (!config.is_active && apiKeyInput.trim()) payload.api_key = apiKeyInput.trim();
      const updated = await whatsappApi.updateConfig(payload, token);
      setConfig(updated);
      setApiKeyInput('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}><Loader2 size={24} className="spin" /></div>;
  if (!config) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}><PackageX size={28} /><p>{error}</p></div>;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>WhatsApp (CRM)</h1>

      <div className={`${styles.statusBanner} ${config.is_active ? styles.active : styles.paused}`}>
        <MessageCircle size={22} />
        <div className={styles.statusText}>
          <strong>{config.is_active ? 'Módulo activo' : 'Módulo pausado'}</strong>
          <span>
            {config.is_active
              ? `Activado por ${config.activated_by_name || '—'} el ${config.activated_at ? new Date(config.activated_at).toLocaleDateString('es-CO') : '—'}`
              : 'No se enviará ningún mensaje hasta que lo actives con tus credenciales de 360dialog.'}
          </span>
        </div>
      </div>

      <div className={styles.warningBox}>
        <AlertTriangle size={14} />
        <span>
          Los recordatorios de carrito y la confirmación de venta son mensajes que tu negocio inicia —
          WhatsApp los cobra si el cliente no tiene una conversación abierta contigo. Responder al instante
          cuando el cliente escribe primero sí es gratis, dentro de la ventana de 24 horas.
        </span>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Credenciales — 360dialog</div>
        <div className={styles.field}>
          <label htmlFor="apikey">D360-API-KEY {config.has_api_key && <ShieldCheck size={12} style={{ verticalAlign: -2, color: 'var(--y)' }} />}</label>
          <input
            id="apikey" type="password"
            placeholder={config.has_api_key ? '•••••••••••••• (ya configurada — deja vacío para no cambiarla)' : 'Pega aquí tu API key de 360dialog'}
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
          />
        </div>
        {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</p>}
        <button
          className={config.is_active ? styles.pauseBtn : styles.activateBtn}
          onClick={toggleActive}
          disabled={saving}
        >
          {saving ? <Loader2 size={15} className="spin" /> : config.is_active ? <PowerOff size={15} /> : <Power size={15} />}
          {config.is_active ? 'Pausar módulo' : 'Activar módulo'}
        </button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Disparadores</div>

        <div className={styles.toggleRow}>
          <div className={styles.toggleInfo}>
            <strong>Responder apenas el cliente escribe</strong>
            <span>Gratis — dentro de la ventana de 24h que abre el cliente</span>
          </div>
          <div
            className={`${styles.switch} ${config.respond_on_message ? styles.on : ''}`}
            onClick={() => setConfig({ ...config, respond_on_message: !config.respond_on_message })}
          >
            <div className={styles.switchDot} />
          </div>
        </div>

        <div className={styles.toggleRow}>
          <div className={styles.toggleInfo}>
            <strong>Recordatorio de carrito abandonado</strong>
            <span>Enviar después de {config.cart_reminder_delay_minutes} minutos</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="number" className={styles.delayInput} value={config.cart_reminder_delay_minutes}
              onChange={(e) => setConfig({ ...config, cart_reminder_delay_minutes: parseInt(e.target.value, 10) || 0 })}
            />
            <div
              className={`${styles.switch} ${config.cart_reminder_enabled ? styles.on : ''}`}
              onClick={() => setConfig({ ...config, cart_reminder_enabled: !config.cart_reminder_enabled })}
            >
              <div className={styles.switchDot} />
            </div>
          </div>
        </div>

        <div className={styles.toggleRow}>
          <div className={styles.toggleInfo}>
            <strong>Seguimiento (preguntó y se fue)</strong>
            <span>Enviar después de {config.followup_delay_hours} horas sin respuesta</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="number" className={styles.delayInput} value={config.followup_delay_hours}
              onChange={(e) => setConfig({ ...config, followup_delay_hours: parseInt(e.target.value, 10) || 0 })}
            />
            <div
              className={`${styles.switch} ${config.followup_enabled ? styles.on : ''}`}
              onClick={() => setConfig({ ...config, followup_enabled: !config.followup_enabled })}
            >
              <div className={styles.switchDot} />
            </div>
          </div>
        </div>

        <div className={styles.toggleRow}>
          <div className={styles.toggleInfo}>
            <strong>Confirmar venta por WhatsApp</strong>
            <span>Al aprobarse el pago con Wompi</span>
          </div>
          <div
            className={`${styles.switch} ${config.order_confirmation_enabled ? styles.on : ''}`}
            onClick={() => setConfig({ ...config, order_confirmation_enabled: !config.order_confirmation_enabled })}
          >
            <div className={styles.switchDot} />
          </div>
        </div>

        <button className={styles.saveBtn} onClick={saveSettings} disabled={saving} style={{ marginTop: 16 }}>
          {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Guardar disparadores
        </button>
      </div>
    </div>
  );
}
