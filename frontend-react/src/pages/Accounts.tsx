import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from '@/components/motion';
import { motion } from 'framer-motion';

function fmt(n: number) {
  if (n >= 1e6) return `฿${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `฿${(n / 1e3).toFixed(0)}K`;
  return `฿${n.toLocaleString()}`;
}

const tierColors: Record<string, { bg: string; text: string }> = {
  platinum: { bg: 'rgba(127,86,217,.1)', text: '#7F56D9' },
  gold: { bg: 'rgba(217,119,6,.1)', text: '#D97706' },
  silver: { bg: 'rgba(100,116,139,.1)', text: '#64748B' },
  standard: { bg: 'rgba(100,116,139,.06)', text: '#64748B' },
};

const statusColors: Record<string, { bg: string; text: string }> = {
  active: { bg: 'rgba(46,132,74,.1)', text: '#2E844A' },
  inactive: { bg: 'rgba(194,57,52,.1)', text: '#C23934' },
};

export function AccountsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data } = useQuery({
    queryKey: ['accounts', search, page],
    queryFn: () => api(`/accounts?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`),
  });

  const items = data?.items || data?.data || (Array.isArray(data) ? data : []);
  const total = data?.total || items.length;
  const totalPages = Math.ceil(total / limit);

  return (
    <PageTransition>
      <div className="px-5 py-5 max-w-[1400px] mx-auto">
        <FadeIn direction="down">
          <div className="mb-5">
            <h1 className="text-[22px] font-bold text-[var(--text)]">Customers</h1>
            <p className="text-[12px] text-[var(--text3)] mt-0.5">Manage all customers — {total} records</p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4">
            <input
              className="w-full bg-[var(--surface2)] border border-[var(--border)] rounded-[10px] px-3.5 py-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--text3)] outline-none focus:border-[var(--sf-blue)] transition-colors mb-4"
              placeholder="Search company name, industry, phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">Code</th>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">Company</th>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">Industry</th>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">Phone</th>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">Status</th>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">Tier</th>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-[var(--text3)] py-8 text-[12px]">No customers found</td>
                    </tr>
                  ) : (
                    items.map((a: any) => {
                      const status = a.account_status || 'active';
                      const tier = a.account_tier || 'standard';
                      const sc = statusColors[status] || statusColors.active;
                      const tc = tierColors[tier] || tierColors.standard;
                      return (
                        <motion.tr
                          key={a.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="hover:bg-[rgba(1,118,211,.02)] cursor-pointer"
                        >
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] font-semibold font-mono text-[var(--sf-blue)]">
                            {a.customer_code && (
                              <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(79,70,229,.08)] text-[#4F46E5]">
                                {a.customer_code}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] font-semibold text-[var(--text)]">{a.company_name}</td>
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] text-[var(--text2)]">{a.industry || '-'}</td>
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] text-[var(--text2)]">{a.phone || '-'}</td>
                          <td className="py-2.5 border-b border-[var(--border)]">
                            <span
                              className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: sc.bg, color: sc.text }}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="py-2.5 border-b border-[var(--border)]">
                            <span
                              className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: tc.bg, color: tc.text }}
                            >
                              {tier}
                            </span>
                          </td>
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] font-bold text-[var(--sf-blue)]">
                            {fmt(parseFloat(a.total_revenue || 0))}
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border)]">
                <span className="text-[11px] text-[var(--text3)]">
                  Page {page} of {totalPages} ({total} records)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[12px] font-semibold px-3 py-1.5 text-[var(--text2)] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[var(--sf-blue)] transition-colors cursor-pointer"
                  >
                    ก่อนหน้า
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[12px] font-semibold px-3 py-1.5 text-[var(--text2)] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[var(--sf-blue)] transition-colors cursor-pointer"
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            )}
          </div>
        </FadeIn>
      </div>
    </PageTransition>
  );
}
