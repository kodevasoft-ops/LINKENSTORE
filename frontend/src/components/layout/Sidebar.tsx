'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useUIStore } from '@/store';
import {
  LayoutDashboard, Package, ShoppingCart, Users, BarChart3,
  Wrench, ClipboardList, Settings, LogOut, ChevronRight,
  Tag, Truck, Bell, Shield, FileText, Home,
} from 'lucide-react';

interface NavItem {
  label: string;
  href:  string;
  icon:  React.ReactNode;
  roles?: string[];
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: 'Principal',
    items: [
      { label: 'Dashboard',   href: '/panel/admin',      icon: <LayoutDashboard size={18} />, roles: ['admin','superadmin'] },
      { label: 'Dashboard',   href: '/panel/superadmin', icon: <LayoutDashboard size={18} />, roles: ['superadmin'] },
      { label: 'Mis Órdenes', href: '/panel/advisor',    icon: <ClipboardList   size={18} />, roles: ['advisor'] },
      { label: 'Reparaciones',href: '/panel/technician', icon: <Wrench          size={18} />, roles: ['technician'] },
      { label: 'Catálogo',    href: '/',                 icon: <Home            size={18} />, roles: ['customer'] },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      { label: 'Productos',   href: '/panel/superadmin?tab=products',   icon: <Package   size={18} />, roles: ['admin','superadmin'] },
      { label: 'Áreas',       href: '/panel/superadmin?tab=areas',      icon: <Tag       size={18} />, roles: ['admin','superadmin'] },
    ],
  },
  {
    title: 'Ventas',
    items: [
      { label: 'Órdenes',     href: '/panel/advisor',               icon: <ShoppingCart size={18} />, roles: ['advisor','admin','superadmin'] },
      { label: 'Envíos',      href: '/panel/advisor?tab=shipping',  icon: <Truck        size={18} />, roles: ['advisor','admin','superadmin'] },
    ],
  },
  {
    title: 'Analíticas',
    items: [
      { label: 'Dashboard',   href: '/panel/admin',                 icon: <BarChart3 size={18} />, roles: ['admin','superadmin'] },
    ],
  },
  {
    title: 'Administración',
    items: [
      { label: 'Usuarios',    href: '/panel/superadmin?tab=users',  icon: <Users    size={18} />, roles: ['superadmin'] },
      { label: 'Auditoría',   href: '/panel/superadmin?tab=audit',  icon: <Shield   size={18} />, roles: ['superadmin'] },
      { label: 'Reportes',    href: '/panel/superadmin?tab=reports',icon: <FileText size={18} />, roles: ['superadmin'] },
      { label: 'Configuración',href:'/panel/superadmin?tab=config', icon: <Settings size={18} />, roles: ['superadmin'] },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const role = (session?.user as any)?.role ?? '';
  const firstName = (session?.user as any)?.first_name ?? '';
  const email = session?.user?.email ?? '';

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href.split('?')[0]);

  return (
    <>
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay show" onClick={toggleSidebar} />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <h1>kata<span>log</span></h1>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Sistema Enterprise
          </p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
          {navSections.map(section => {
            const visibleItems = section.items.filter(item =>
              !item.roles || item.roles.includes(role)
            );
            if (!visibleItems.length) return null;

            return (
              <div key={section.title}>
                <p className="sidebar-section-title">{section.title}</p>
                {visibleItems.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => sidebarOpen && toggleSidebar()}
                    className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {isActive(item.href) && (
                      <ChevronRight size={14} style={{ opacity: 0.5 }} />
                    )}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 8px 16px' }}>
          <div style={{ padding: '10px 12px', marginBottom: 4 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              background: 'var(--bg-card-hover)',
              borderRadius: 10,
              marginBottom: 4,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {firstName?.[0]?.toUpperCase() || email[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {firstName || email.split('@')[0]}
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {role}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            className="nav-item"
            style={{ color: 'var(--danger)', width: 'calc(100% - 16px)' }}
          >
            <LogOut size={18} style={{ opacity: 0.8 }} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
