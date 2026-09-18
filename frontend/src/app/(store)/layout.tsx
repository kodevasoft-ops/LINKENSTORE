import SiteShell from './SiteShell';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
