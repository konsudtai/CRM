import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageTransition, FadeIn, AnimatedCard } from '@/components/motion';

export function ContactsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search, page],
    queryFn: () => api('/contacts', { params: { search, page: String(page), limit: '20' } }),
    placeholderData: { items: [], total: 0 },
  });

  const contacts = data?.items || data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <FadeIn direction="down">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ผู้ติดต่อ</h1>
              <p className="text-sm text-slate-500 mt-1">รายชื่อผู้ติดต่อทั้งหมด</p>
            </div>
            <button className="px-4 py-2 rounded-xl bg-sf-blue text-white text-sm font-semibold hover:bg-sf-blue-d transition shadow-md shadow-sf-blue/20">
              + เพิ่มผู้ติดต่อ
            </button>
          </div>
        </FadeIn>

        <AnimatedCard delay={0.1} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="ค้นหาชื่อ, อีเมล, โทรศัพท์..."
              className="w-full max-w-md px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:border-sf-blue focus:ring-2 focus:ring-sf-blue/10 outline-none transition"
            />
          </div>

          {isLoading ? (
            <p className="text-center text-slate-400 py-16 text-sm">กำลังโหลด...</p>
          ) : contacts.length === 0 ? (
            <p className="text-center text-slate-400 py-16 text-sm">ไม่พบผู้ติดต่อ</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">ชื่อ</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">ตำแหน่ง</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">อีเมล</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">โทรศัพท์</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">LINE ID</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c: any) => (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-800">{c.first_name || c.firstName} {c.last_name || c.lastName}</td>
                      <td className="px-5 py-3 text-slate-600">{c.title || '-'}</td>
                      <td className="px-5 py-3 text-slate-600">{c.email || '-'}</td>
                      <td className="px-5 py-3 text-slate-600">{c.phone || '-'}</td>
                      <td className="px-5 py-3 text-slate-500">{c.line_id || c.lineId || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
              <span className="text-xs text-slate-500">หน้า {page}/{totalPages}</span>
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
