import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageTransition, FadeIn, AnimatedCard } from '@/components/motion';

export function AccountsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['accounts', search, page],
    queryFn: () => api('/accounts', { params: { search, page: String(page), limit: '20' } }),
    placeholderData: { items: [], total: 0 },
  });

  const accounts = data?.items || data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <FadeIn direction="down">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">บัญชีลูกค้า</h1>
              <p className="text-sm text-slate-500 mt-1">จัดการบัญชีลูกค้าทั้งหมด</p>
            </div>
            <button className="px-4 py-2 rounded-xl bg-sf-blue text-white text-sm font-semibold hover:bg-sf-blue-d transition shadow-md shadow-sf-blue/20">
              + สร้างบัญชี
            </button>
          </div>
        </FadeIn>

        <AnimatedCard delay={0.1} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700 overflow-hidden">
          {/* Search */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="ค้นหาชื่อบริษัท, อีเมล, โทรศัพท์..."
              className="w-full max-w-md px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm bg-slate-50 dark:bg-slate-700 focus:border-sf-blue focus:ring-2 focus:ring-sf-blue/10 outline-none transition"
            />
          </div>

          {/* Table */}
          {isLoading ? (
            <p className="text-center text-slate-400 py-16 text-sm">กำลังโหลด...</p>
          ) : accounts.length === 0 ? (
            <p className="text-center text-slate-400 py-16 text-sm">ไม่พบบัญชีลูกค้า</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">รหัส</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">ชื่อบริษัท</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">อุตสาหกรรม</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">โทรศัพท์</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tier</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a: any) => (
                    <tr key={a.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 font-mono text-xs font-semibold">
                          {a.customer_code || a.customerCode || '-'}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-medium text-sf-blue hover:underline cursor-pointer">
                        {a.company_name || a.companyName}
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{a.industry || '-'}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{a.phone || '-'}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          a.account_tier === 'platinum' ? 'bg-purple-50 text-purple-700' :
                          a.account_tier === 'gold' ? 'bg-amber-50 text-amber-700' :
                          a.account_tier === 'silver' ? 'bg-slate-100 text-slate-600' :
                          'bg-slate-50 text-slate-500'
                        }`}>
                          {a.account_tier || 'standard'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          a.account_status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        }`}>
                          {a.account_status || 'active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-500">หน้า {page}/{totalPages} ({total} รายการ)</span>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium disabled:opacity-40 hover:bg-slate-50 transition">ก่อนหน้า</button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium disabled:opacity-40 hover:bg-slate-50 transition">ถัดไป</button>
              </div>
            </div>
          )}
        </AnimatedCard>
      </div>
    </PageTransition>
  );
}
