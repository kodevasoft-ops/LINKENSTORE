'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { Grid3X3, ChevronRight } from 'lucide-react';
import { SkeletonBox } from '@/components/ui/Skeletons';
import api from '@/lib/api';

interface Area { id: string; slug: string; name: string; icon?: string; products_count?: number }

const fetcher = (url: string) => api.get(url).then(r => r.data);

const COLORS = [
  { bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.2)',  text: '#818cf8' },
  { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)',  text: '#34d399' },
  { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)',  text: '#fbbf24' },
  { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',   text: '#f87171' },
  { bg: 'rgba(34,211,238,0.08)', border: 'rgba(34,211,238,0.2)',  text: '#22d3ee' },
  { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.2)',  text: '#c084fc' },
];

export default function AreasGrid() {
  const { data, isLoading } = useSWR<any[]>('/api/v1/areas/menu/', fetcher);
  const areas: Area[] = Array.isArray(data) ? data : [];

  return (
    <section style={{ padding: '40px 0 0' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Grid3X3 size={18} color="var(--primary)" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Explorar por área
            </h2>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonBox key={i} h={90} radius={12} />)
            : areas.map((area, i) => {
                const c = COLORS[i % COLORS.length];
                return (
                  <Link key={area.id} href={`/catalog?area=${area.slug}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: c.bg, border: `1px solid ${c.border}`,
                      borderRadius: 12, padding: '18px 14px', textAlign: 'center',
                      cursor: 'pointer', transition: 'all 0.2s ease',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 30px ${c.bg}`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
                    >
                      <p style={{ fontSize: '0.875rem', fontWeight: 700, color: c.text, marginBottom: 4 }}>
                        {area.name}
                      </p>
                      {area.products_count !== undefined && (
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {area.products_count} productos
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })
          }
        </div>
      </div>
    </section>
  );
}
