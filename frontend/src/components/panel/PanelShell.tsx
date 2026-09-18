'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LayoutDashboard, ShoppingBag, Truck, Package, Wrench, MessageCircle, Tag } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './PanelShell.module.css';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/panel/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['supervisor', 'superadmin'] },
  { href: '/panel/ventas',    label: 'Ventas',     icon: ShoppingBag,    roles: ['vendedor', 'administrador', 'supervisor', 'superadmin'] },
  { href: '/panel/envios',    label: 'Envíos',     icon: Truck,          roles: ['vendedor', 'administrador', 'supervisor', 'superadmin'] },
  { href: '/panel/productos', label: 'Productos',  icon: Package,        roles: ['administrador', 'supervisor', 'superadmin'] },
  { href: '/panel/tecnicos',  label: 'Técnicos',   icon: Wrench,         roles: ['tecnico', 'administrador_tecnico', 'supervisor', 'superadmin'] },
  { href: '/panel/whatsapp',  label: 'WhatsApp',   icon: MessageCircle,  roles: ['administrador', 'superadmin'] },
  { href: '/panel/cupones',   label: 'Cupones',    icon: Tag,            roles: ['superadmin'] },
];

const ROLE_LABELS: Record<string, string> = {
  vendedor: 'Vendedor', administrador: 'Administrador', superadmin: 'SuperAdministrador',
  tecnico: 'Técnico', administrador_tecnico: 'Administrador Técnico', supervisor: 'Supervisor',
};

export default function PanelShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || '';
  const puntoName = (session?.user as { puntoName?: string })?.puntoName;

  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar}>
        <div className={styles.logo}>
          Celu<em>Fénix</em> · Panel
        </div>
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`${styles.navItem} ${active ? styles.active : ''}`}>
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <div className={styles.roleBadge}>
          {ROLE_LABELS[role] || role}
          {puntoName ? ` · ${puntoName}` : ''}
        </div>
      </nav>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
