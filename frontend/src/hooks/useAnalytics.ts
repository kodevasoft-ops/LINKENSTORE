'use client';
import { useCallback, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import api from '@/lib/api';

function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let sid = sessionStorage.getItem('_ksid');
  if (!sid) {
    sid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem('_ksid', sid);
  }
  return sid;
}

function fire(endpoint: string, payload: Record<string, unknown>) {
  api.post(endpoint, { ...payload, session_id: getSessionId() }).catch(() => {});
}

export function useAnalytics() {
  const lastSearchRef = useRef<{ query: string; ts: number } | null>(null);
  const cartStartRef  = useRef<number>(Date.now());

  const trackSearch = useCallback((query: string, resultsCount: number, areaSlug?: string) => {
    const q = query.trim();
    if (!q || q.length < 2) return;
    const now = Date.now();
    const last = lastSearchRef.current;
    if (last && last.query === q && now - last.ts < 5000) return;
    lastSearchRef.current = { query: q, ts: now };
    fire('/api/v1/analytics/track/search/', { query: q, results_count: resultsCount, area_slug: areaSlug ?? '' });
  }, []);

  const trackPageView = useCallback((path?: string, referrer?: string) => {
    fire('/api/v1/analytics/track/pageview/', {
      path:    path     ?? (typeof window !== 'undefined' ? window.location.pathname : ''),
      referrer: referrer ?? (typeof document !== 'undefined' ? document.referrer : ''),
    });
  }, []);

  type CartEvent = 'add_item'|'remove_item'|'update_qty'|'view_cart'|'start_checkout'|'abandon_cart'|'complete_order';

  const trackCart = useCallback((eventType: CartEvent, opts?: { itemsCount?: number; cartTotal?: number; areaName?: string }) => {
    if (eventType === 'add_item') cartStartRef.current = Date.now();
    fire('/api/v1/analytics/track/cart/', {
      event_type:        eventType,
      cart_items_count:  opts?.itemsCount ?? 0,
      cart_total:        opts?.cartTotal  ?? 0,
      area_name:         opts?.areaName   ?? '',
      inactivity_seconds: eventType === 'abandon_cart'
        ? Math.floor((Date.now() - cartStartRef.current) / 1000)
        : undefined,
    });
  }, []);

  const trackCartAbandonment = useCallback((opts: { cartTotal: number; itemsCount: number; email?: string; lastStep?: string }) => {
    fire('/api/v1/analytics/track/cart/', { event_type: 'abandon_cart', cart_items_count: opts.itemsCount, cart_total: opts.cartTotal });
    if (opts.email) {
      api.post('/api/v1/analytics/track/abandonment/', {
        session_id: getSessionId(), email: opts.email,
        cart_total: opts.cartTotal, items_count: opts.itemsCount,
        last_step: opts.lastStep ?? 'cart',
        time_in_cart_seconds: Math.floor((Date.now() - cartStartRef.current) / 1000),
      }).catch(() => {});
    }
  }, []);

  return { trackSearch, trackPageView, trackCart, trackCartAbandonment };
}

export function useAutoPageView() {
  const pathname = usePathname();
  const { trackPageView } = useAnalytics();
  useEffect(() => { trackPageView(pathname); }, [pathname]); // eslint-disable-line
}
