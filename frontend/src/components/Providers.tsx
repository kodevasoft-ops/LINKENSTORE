'use client';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { useAuthStore, useCartStore } from '@/store';
import { useAutoPageView } from '@/hooks/useAnalytics';

function StoreHydrator() {
  const hydrateAuth = useAuthStore(s => s.hydrate);
  const hydrateCart = useCartStore(s => s.hydrate);
  useEffect(() => { hydrateAuth(); hydrateCart(); }, [hydrateAuth, hydrateCart]);
  return null;
}

function AutoPageView() { useAutoPageView(); return null; }

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <StoreHydrator />
      <AutoPageView />
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background:   '#16161f',
            color:        '#f1f5f9',
            border:       '1px solid #2a2a3a',
            borderRadius: '12px',
            fontSize:     '14px',
            fontFamily:   'var(--font-inter)',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          duration: 3500,
        }}
      />
    </SessionProvider>
  );
}
