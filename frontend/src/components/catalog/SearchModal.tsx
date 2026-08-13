'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Clock, X, ArrowUpRight, Loader2 } from 'lucide-react';
import { useAnalytics } from '@/hooks/useAnalytics';
import api from '@/lib/api';

interface Suggestion { slug: string; name: string; area: string; price: number; image?: string }

const HISTORY_KEY = 'katalog_search_history';
const getHistory  = (): string[] => { try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? '[]'); } catch { return []; } };
const saveHistory = (q: string)  => { const prev = getHistory().filter(x => x !== q); sessionStorage.setItem(HISTORY_KEY, JSON.stringify([q, ...prev].slice(0, 8))); };

interface Props { open: boolean; onClose: () => void }

export default function SearchModal({ open, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { trackSearch } = useAnalytics();

  const [query,       setQuery]       = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [history,     setHistory]     = useState<string[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [selected,    setSelected]    = useState(-1);

  useEffect(() => {
    if (open) { setHistory(getHistory()); setQuery(''); setSuggestions([]); setTimeout(() => inputRef.current?.focus(), 80); }
  }, [open]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const handleInput = useCallback((val: string) => {
    setQuery(val); setSelected(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim() || val.length < 2) { setSuggestions([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/api/v1/products/search-suggestions/', { params: { q: val, limit: 6 } });
        setSuggestions(data.results ?? []);
        trackSearch(val, data.results?.length ?? 0);
      } catch { setSuggestions([]); } finally { setLoading(false); }
    }, 280);
  }, [trackSearch]);

  const navigate = useCallback((slug: string, q?: string) => {
    if (q) saveHistory(q); else if (query.trim()) saveHistory(query.trim());
    onClose(); router.push(`/product/${slug}`);
  }, [query, router, onClose]);

  const doSearch = useCallback((q = query) => {
    if (!q.trim()) return;
    saveHistory(q.trim()); trackSearch(q, suggestions.length);
    onClose(); router.push(`/catalog?q=${encodeURIComponent(q.trim())}`);
  }, [query, suggestions.length, trackSearch, router, onClose]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(p => Math.min(p + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(p => Math.max(p - 1, -1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (selected >= 0 && suggestions[selected]) navigate(suggestions[selected].slug, query);
      else doSearch();
    }
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80, padding: '80px 16px 16px' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 640, background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', animation: 'slideUp 0.2s ease' }}>
        {/* Input row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          {loading
            ? <Loader2 size={18} color="var(--primary)" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            : <Search size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          }
          <input
            ref={inputRef} type="text" value={query}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar productos, marcas, referencias…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '0.95rem', color: 'var(--text-primary)', fontFamily: 'inherit' }}
          />
          {query && <button className="btn btn-ghost btn-icon" onClick={() => { setQuery(''); setSuggestions([]); inputRef.current?.focus(); }}><X size={16} /></button>}
          <kbd style={{ fontSize: '0.72rem', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', flexShrink: 0 }}>ESC</kbd>
        </div>

        {/* Suggestions */}
        {query.length >= 2 && suggestions.length > 0 && (
          <div>
            {suggestions.map((s, i) => (
              <button key={s.slug} onClick={() => navigate(s.slug, query)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: selected === i ? 'var(--bg-card-hover)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = selected === i ? 'var(--bg-card-hover)' : 'transparent')}
              >
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-card-hover)', overflow: 'hidden', flexShrink: 0 }}>
                  {s.image ? <img src={s.image} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={18} color="var(--text-muted)" /></div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.area}</p>
                </div>
                <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  ${Number(s.price).toLocaleString('es-CO')}
                </span>
              </button>
            ))}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => doSearch()} style={{ fontSize: '0.82rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                Ver todos los resultados para "{query}" <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* No results */}
        {query.length >= 2 && !loading && suggestions.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            <p>Sin resultados para "<span style={{ color: 'var(--text-secondary)' }}>{query}</span>"</p>
            <button onClick={() => doSearch()} style={{ marginTop: 8, fontSize: '0.82rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Buscar en todo el catálogo
            </button>
          </div>
        )}

        {/* History */}
        {!query && history.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 4px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Recientes</span>
              <button onClick={() => { sessionStorage.removeItem(HISTORY_KEY); setHistory([]); }} style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Limpiar</button>
            </div>
            {history.map(h => (
              <button key={h} onClick={() => doSearch(h)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Clock size={15} color="var(--text-muted)" />
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{h}</span>
              </button>
            ))}
          </div>
        )}

        {!query && history.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Escribe para buscar productos
          </div>
        )}
      </div>
    </div>
  );
}

// Needed for the import inside SearchModal
import { Package } from 'lucide-react';
