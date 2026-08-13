'use client';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface PanelLayoutProps {
  children:   React.ReactNode;
  title?:     string;
  subtitle?:  string;
  actions?:   React.ReactNode;
  allowedRoles?: string[];
}

export default function PanelLayout({
  children, title, subtitle, actions, allowedRoles,
}: PanelLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) { router.replace('/auth/login'); return; }
    if (allowedRoles && !allowedRoles.includes(role)) {
      router.replace('/auth/login');
    }
  }, [session, status, role, allowedRoles, router]);

  if (status === 'loading' || !session) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid var(--border)',
          borderTopColor: 'var(--primary)',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Topbar title={title} subtitle={subtitle} actions={actions} />
        <div className="page-content">
          {children}
        </div>
      </div>
    </div>
  );
}
