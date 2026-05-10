import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from '@/components/motion';

export function ProductsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api('/products'),
    placeholderData: [],
  });

  const products = Array.isArray(data) ? data : data?.data || [];

  function fmt(n: number) {
    if (!n) return '฿0';
    return `฿${n.toLocaleString()}`;
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <FadeIn direction="down">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">สินค้า</h1>
              <p className="text-sm text-slate-500 mt-1">จัดการสินค้าและบริการ</p>
            </div>
            <button className="px-4 py-2 rounded-xl bg-sf-blue text-white text-sm font-semibold hover:bg-sf-blue-d transition shadow-md shadow-sf-blue/20">
              + เพิ่มสินค้า
            </button>
          </div>
        </FadeIn>

        {isLoading ? (
          <p className="text-center text-slate-400 py-16">กำลังโหลด...</p>
        ) : products.length === 0 ? (
          <p className="text-center text-slate-400 py-16 text-sm">ไม่พบสินค้า</p>
        ) : (
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((p: any) => (
              <StaggerItem key={p.id}>
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 p-5 hover:border-sf-blue hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <span className="inline-flex px-2 py-0.5 rounded-md bg-sf-blue/10 text-sf-blue text-[10px] font-bold uppercase tracking-wider">
                      {p.sku}
                    </span>
                    {p.is_active !== false && (
                      <span className="w-2 h-2 rounded-full bg-green-400" title="Active" />
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1 line-clamp-2">{p.name}</h3>
                  <p className="text-xs text-slate-500 mb-4 line-clamp-2">{p.description || '-'}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                    <span className="text-lg font-bold text-slate-900 dark:text-white">{fmt(p.unit_price || p.unitPrice)}</span>
                    <span className="text-xs text-slate-400">/{p.unit_of_measure || p.unitOfMeasure || 'ชิ้น'}</span>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </div>
    </PageTransition>
  );
}
