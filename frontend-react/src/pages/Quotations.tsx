import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageTransition, FadeIn, AnimatedCard } from '@/components/motion';

const STATUSES = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'draft', label: 'ร่าง' },
  { key: 'pending_approval', label: 'รออนุมัติ' },
  { key: 'sent', label: 'ส่งแล้ว' },
  { key: 'accepted', label: 'ยอมรับ' },
  { key: 'rejected', label: 'ปฏิเสธ' },
  { key: 'expired', label: 'หมดอายุ' },
];

const statusColor: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  pending_approval: 'bg-amber-50 text-amber-700',
  sent: 'bg-blue-50 text-blue-700',
  accepted: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
  expired: 'bg-orange-50 text-orange-700',
};

export function QuotationsPage() {
  const [filter, setFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', filter],
    queryFn: () => api('/quotations', { params: filter !== 'all' ? { status: filter } : {} }),
    placeholderData: [],
  });

  const quotations = Array.isArray(data) ? data : data?.data || [];

  function fmt(n: number) {
    if (!n) return '฿0';
    if (n >= 1e6) return `฿${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `฿${(n / 1e3).toFixed(0)}K`;
    return `฿${n.toLocaleString()}`;
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <FadeIn direction="down">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ใบเสนอราคา</h1>
              <p className="text-sm text-slate-500 mt-1">สร้างและจัดการใบเสนอราคา</p>
            </div>
            <button className="px-4 py-2 rounded-xl bg-sf-blue text-white text-sm font-semibold hover:bg-sf-blue-d transition shadow-md shadow-sf-blue/20">
              + สร้างใบเสนอราคา
            </button>
          </div>
        </FadeIn>

        {/* Filters */}
        <div className="flex gap-1.5 mb-5 bg-slate-100 rounded-lg p-1 w-fit overflow-x-auto">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition whitespace-nowrap ${
                filter === s.key ? 'bg-white text-sf-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-center text-slate-400 py-16">กำลังโหลด...</p>
        ) : (
          <AnimatedCard className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 overflow-hidden">
            {quotations.length === 0 ? (
              <p className="text-center text-slate-400 py-16 text-sm">ไม่พบใบเสนอราคา</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">เลขที่</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">สถานะ</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">ยอดรวม</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">VAT 7%</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">ยอดสุทธิ</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">วันที่</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotations.map((q: any) => (
                      <tr key={q.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-sf-blue hover:underline cursor-pointer">
                          {q.quotation_number || q.quotationNumber || '-'}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[q.status] || 'bg-slate-100 text-slate-500'}`}>
                            {STATUSES.find((s) => s.key === q.status)?.label || q.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-700">{fmt(q.subtotal)}</td>
                        <td className="px-5 py-3 text-slate-500">{fmt(q.vat_amount || q.vatAmount)}</td>
                        <td className="px-5 py-3 font-bold text-sf-blue">{fmt(q.grand_total || q.grandTotal)}</td>
                        <td className="px-5 py-3 text-slate-500">
                          {new Date(q.created_at || q.createdAt).toLocaleDateString('th-TH')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AnimatedCard>
        )}
      </div>
    </PageTransition>
  );
}
