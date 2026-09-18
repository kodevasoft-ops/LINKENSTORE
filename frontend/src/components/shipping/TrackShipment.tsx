'use client';

import { useState } from 'react';
import { Truck, Search, Loader2, AlertCircle } from 'lucide-react';
import { shippingApi, type TrackShipmentResult } from '@/lib/api';
import styles from './TrackShipment.module.css';

export default function TrackShipment() {
  const [guide, setGuide] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackShipmentResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guide.trim()) return;
    setLoading(true);
    setResult(null);
    const res = await shippingApi.track(guide.trim());
    setResult(res);
    setLoading(false);
  };

  return (
    <div className={styles.box}>
      <div className={styles.head}>
        <Truck size={20} color="var(--y)" />
        <h3>Rastrear mi envío</h3>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          placeholder="Número de guía"
          value={guide}
          onChange={(e) => setGuide(e.target.value)}
        />
        <button className={styles.btn} type="submit" disabled={loading}>
          {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
          Buscar
        </button>
      </form>

      {result && !result.encontrado && (
        <div className={styles.error}>
          <AlertCircle size={14} />
          <span>{result.error || 'No encontramos información para esa guía.'}</span>
        </div>
      )}

      {result?.encontrado && result.datos && (
        <div className={styles.result}>
          {Object.entries(result.datos)
            .filter(([key]) => key !== 'ultima_actualizacion')
            .map(([key, value]) => (
              <div key={key} className={styles.resultRow}>
                <span>{key.replace(/_/g, ' ')}</span>
                <span>{String(value)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
