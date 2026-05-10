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

export function ContactsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data } = useQuery({
    queryKey: ['contacts', search, page],
    queryFn: () => api(`/contacts?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`),
  });

  const items = data?.items || data?.data || (Array.isArray(data) ? data : []);
  const total = data?.total || items.length;
  const totalPages = Math.ceil(total / limit);

  return (
    <PageTransition>
      <div className="px-5 py-5 max-w-[1400px] mx-auto">
        <FadeIn direction="down">
          <div className="mb-5">
            <h1 className="text-[22px] font-bold text-[var(--text)]">ผู้ติดต่อ</h1>
            <p className="text-[12px] text-[var(--text3)] mt-0.5">รายชื่อผู้ติดต่อทั้งหมด — {total} รายการ</p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4">
            <input
              className="w-full bg-[var(--surface2)] border border-[var(--border)] rounded-[10px] px-3.5 py-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--text3)] outline-none focus:border-[var(--sf-blue)] transition-colors mb-4"
              placeholder="ค้นหาชื่อ, อีเมล, โทรศัพท์..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">ชื่อ</th>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">ตำแหน่ง</th>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">อีเมล</th>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">โทรศัพท์</th>
                    <th className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)]">LINE ID</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-[var(--text3)] py-8 text-[12px]">ไม่พบผู้ติดต่อ</td>
                    </tr>
                  ) : (
                    items.map((c: any) => {
                      const name = c.first_name || c.name
                        ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name
                        : '-';
                      return (
                        <motion.tr
                          key={c.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="hover:bg-[rgba(1,118,211,.02)]"
                        >
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] font-semibold text-[var(--text)]">{name}</td>
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] text-[var(--text2)]">{c.title || c.position || '-'}</td>
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] text-[var(--text2)]">{c.email || '-'}</td>
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] text-[var(--text2)]">{c.phone || '-'}</td>
                          <td className="py-2.5 border-b border-[var(--border)] text-[12px] text-[var(--text2)]">{c.line_id || c.lineId || '—'}</td>
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
                  หน้า {page} จาก {totalPages} ({total} รายการ)
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
