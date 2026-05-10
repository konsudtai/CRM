import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem, AnimatedCard } from '@/components/motion';
import { motion } from 'framer-motion';

function fmt(n: number) {
  if (n >= 1e6) return `฿${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `฿${(n / 1e3).toFixed(0)}K`;
  return `฿${n.toLocaleString()}`;
}

export function ProductsPage() {
  const { data } = useQuery({
    queryKey: ['products'],
    queryFn: () => api('/products'),
  });

  const items = Array.isArray(data) ? data : data?.data || [];

  return (
    <PageTransition>
      <div className="px-5 py-5 max-w-[1400px] mx-auto">
        <FadeIn direction="down">
          <div className="mb-5">
            <h1 className="text-[22px] font-bold text-[var(--text)]">แคตตาล็อกสินค้า</h1>
            <p className="text-[12px] text-[var(--text3)] mt-0.5">จัดการสินค้าและบริการ — {items.length} รายการ</p>
          </div>
        </FadeIn>

        {items.length === 0 ? (
          <FadeIn delay={0.1}>
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-8 text-center">
              <p className="text-[var(--text3)] text-[13px]">ไม่พบสินค้า</p>
            </div>
          </FadeIn>
        ) : (
          <StaggerContainer className="grid grid-cols-3 gap-3.5 max-[1024px]:grid-cols-2 max-[640px]:grid-cols-1">
            {items.map((p: any, i: number) => {
              const isActive = p.is_active !== false;
              return (
                <StaggerItem key={p.id}>
                  <AnimatedCard
                    className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 relative overflow-hidden"
                    delay={i * 0.05}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute top-4 right-4 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#2E844A] animate-pulse" />
                        <span className="text-[9px] font-semibold text-[#2E844A]">Active</span>
                      </div>
                    )}

                    {/* SKU Badge */}
                    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(1,118,211,.08)] text-[var(--sf-blue)] mb-2">
                      {p.sku}
                    </span>

                    {/* Name */}
                    <h3 className="text-[14px] font-bold text-[var(--text)] leading-tight mb-1">{p.name}</h3>

                    {/* Description */}
                    {p.description && (
                      <p className="text-[11px] text-[var(--text3)] line-clamp-2 mb-3">{p.description}</p>
                    )}

                    {/* Price & Unit */}
                    <div className="flex items-end justify-between mt-auto pt-3 border-t border-[var(--border)]">
                      <div>
                        <div className="text-[18px] font-extrabold text-[var(--sf-blue)]">{fmt(parseFloat(p.unit_price) || 0)}</div>
                        <div className="text-[10px] text-[var(--text3)]">ต่อ {p.unit_of_measure || 'ชุด'}</div>
                      </div>
                      {p.wht_rate > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(100,116,139,.08)] text-[var(--text2)]">
                          WHT {p.wht_rate}%
                        </span>
                      )}
                    </div>
                  </AnimatedCard>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}
      </div>
    </PageTransition>
  );
}
