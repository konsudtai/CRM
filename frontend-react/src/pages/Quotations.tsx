import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageTransition, FadeIn } from '@/components/motion';
import { motion } from 'framer-motion';

function fmt(n: number) {
  if (n >= 1e6) return `฿${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `฿${(n / 1e3).toFixed(0)}K`;
  return `฿${n.toLocaleString()}`;
}

const STATUS_FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'draft', label: 'ร่าง' },
  { key: 'pending_approval', label: 'รออนุมัติ' },
  { key: 'sent', label: 'ส่งแล้ว' },
  { key: 'accepted', label: 'ยอมรับ' },
  { key: 'rejected', label: 'ปฏิเสธ' },
  { key: 'expired', label: 'หมดอายุ' },
];

const statusColors: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'rgba(100,116,139,.1)', text: '#64748B' },
  pending_approval: { bg: 'rgba(217,119,6,.1)', text: '#D97706' },
  sent: { bg: 'rgba(1,118,211,.1)', text: '#0176D3' },
  accepted: { bg: 'rgba(46,132,74,.1)', text: '#2E844A' },
  rejected: { bg: 'rgba(194,57,52,.1)', text: '#C23934' },
  expired: { bg: 'rgba(221,122,1,.1)', text: '#DD7A01' },
};

const statusLabels: Record<string, string> = {
  draft: 'ร่าง',
  pending_approval: 'รออนุมัติ',
  sent: 'ส่งแล้ว',
  accepted: 'ยอมรับ',
  rejected: 'ปฏิเสธ',
  expired: 'หมดอายุ',
};

export function QuotationsPage() {
  const [filter, setFilter] = useState('all');

  const { data } = useQuery({
    queryKey: ['quotations', filter],
    queryFn: () => api(`/quotations${filter !== 'all' ? `?status=${filter}` : ''}`),
  });

  const items = Array.isArray(data) ? data : data?.data || [];

  return (
    <PageTransition>
      <div className="px-5 py-5 max-w-[1400px] mx-auto">
        <FadeIn direction="down">
          <div className="mb-5">
            <h1 className="text-[22px] font-bold text-[var(--text)]">Quotations</h1>
            <p className="text-[12px] text-[var(--text3)] mt-0.5">Create and manage quotations — VAT 7% / WHT auto-calculated</p>
          </div>
        </FadeIn>

        {/* Filter Bar */}
        <FadeIn delay={0.1}>
          <div className="flex gap-1 bg-[rgba(3,45,96,.05)] rounded-lg p-1 mb-4 w-fit flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all cursor-pointer ${
                  filter === f.key ? 'bg-white shadow-sm text-[var(--text)]' : 'text-[var(--text2)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">เลขที่</th>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">สถานะ</th>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">ยอดรวม</th>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">VAT 7%</th>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">WHT</th>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">ยอดสุทธิ</th>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">วันที่</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-[var(--text3)] py-8 text-[12px]">ไม่พบใบเสนอราคา</td>
                    </tr>
                  ) : (
                    items.map((q: any) => {
                      const sc = statusColors[q.status] || statusColors.draft;
                      const dateStr = q.created_at ? new Date(q.created_at).toLocaleDateString('th-TH') : '-';
                      return (
                        <motion.tr
                          key={q.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="hover:bg-[rgba(1,118,211,.02)]"
                        >
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] font-semibold text-[var(--sf-blue)]">
                            {q.quotation_number || '-'}
                          </td>
                          <td className="py-2.5 border-b border-[var(--border)]">
                            <span
                              className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: sc.bg, color: sc.text }}
                            >
                              {statusLabels[q.status] || q.status}
                            </span>
                          </td>
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] text-[var(--text)]">
                            {fmt(parseFloat(q.subtotal) || 0)}
                          </td>
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] text-[var(--text2)]">
                            {fmt(parseFloat(q.vat_amount) || 0)}
                          </td>
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] text-[#C23934]">
                            -{fmt(parseFloat(q.wht_amount) || 0)}
                          </td>
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] font-bold text-[var(--sf-blue)]">
                            {fmt(parseFloat(q.grand_total) || 0)}
                          </td>
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] text-[var(--text2)]">
                            {dateStr}
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </FadeIn>
      </div>
    </PageTransition>
  );
}
