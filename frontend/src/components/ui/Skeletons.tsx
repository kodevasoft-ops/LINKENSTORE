export function SkeletonBox({ w = '100%', h = 16, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div
      className="skeleton"
      style={{ width: w, height: h, borderRadius: radius, flexShrink: 0 }}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="glass-card" style={{ overflow: 'hidden' }}>
      <div className="skeleton" style={{ aspectRatio: '1', width: '100%' }} />
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonBox h={10} w="40%" />
        <SkeletonBox h={14} w="80%" />
        <SkeletonBox h={12} w="55%" />
      </div>
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
      <SkeletonBox h={400} radius={16} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SkeletonBox h={12} w="30%" />
        <SkeletonBox h={28} w="85%" />
        <SkeletonBox h={20} w="40%" />
        <SkeletonBox h={80} radius={12} />
        <SkeletonBox h={48} radius={12} />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '14px 16px' }}>
          <SkeletonBox h={14} w={i === 0 ? '60%' : i === cols - 1 ? '40%' : '80%'} />
        </td>
      ))}
    </tr>
  );
}

export function KpiSkeleton() {
  return (
    <div className="kpi-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SkeletonBox h={12} w="50%" />
      <SkeletonBox h={32} w="70%" />
      <SkeletonBox h={10} w="40%" />
    </div>
  );
}

export function RepairCardSkeleton() {
  return (
    <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <SkeletonBox h={12} w="35%" />
        <SkeletonBox h={20} w="20%" radius={99} />
      </div>
      <SkeletonBox h={18} w="70%" />
      <SkeletonBox h={14} w="100%" />
      <SkeletonBox h={14} w="85%" />
    </div>
  );
}

export function OrderRowSkeleton() {
  return <div className="skeleton" style={{ height: 64, borderRadius: 12 }} />;
}
