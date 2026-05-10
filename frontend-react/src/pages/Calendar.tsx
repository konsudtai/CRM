import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageTransition, FadeIn } from '@/components/motion';
import { motion } from 'framer-motion';

const THAI_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const PRIORITY_COLORS: Record<string, string> = { High: '#C23934', Medium: '#DD7A01', Low: '#8E9BAE' };

export function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api('/tasks'),
  });

  const tasks = Array.isArray(data) ? data : data?.data || [];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  function getTasksForDate(d: number) {
    return tasks.filter((t: any) => {
      if (!t.due_date) return false;
      const dd = new Date(t.due_date);
      return dd.getFullYear() === year && dd.getMonth() === month && dd.getDate() === d;
    });
  }

  function navMonth(dir: number) {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + dir);
    setCurrentDate(next);
  }

  return (
    <PageTransition>
      <div className="px-5 py-5 max-w-[1400px] mx-auto">
        <FadeIn direction="down">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-[22px] font-bold text-[var(--text)]">ปฏิทิน</h1>
              <p className="text-[12px] text-[var(--text3)] mt-0.5">ดูงาน นัดหมาย และการประชุม</p>
            </div>
            <div className="flex gap-2">
              <a href="/tasks" className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[12px] font-semibold px-3 py-2 text-[var(--text2)] no-underline hover:border-[var(--sf-blue)] transition-colors">รายการงาน</a>
            </div>
          </div>
        </FadeIn>

        {/* Month navigation */}
        <FadeIn delay={0.1}>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navMonth(-1)} className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[var(--text2)] cursor-pointer hover:border-[var(--sf-blue)] transition-colors">←</button>
            <span className="text-[14px] font-semibold text-[var(--text)] min-w-[180px] text-center">
              {THAI_MONTHS[month]} {year + 543}
            </span>
            <button onClick={() => navMonth(1)} className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[var(--text2)] cursor-pointer hover:border-[var(--sf-blue)] transition-colors">→</button>
            <button onClick={() => setCurrentDate(new Date())} className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[var(--sf-blue)] text-[12px] font-semibold cursor-pointer hover:border-[var(--sf-blue)] transition-colors">วันนี้</button>
          </div>
        </FadeIn>

        {/* Calendar grid */}
        <FadeIn delay={0.15}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-[var(--border)]">
              {THAI_DAYS.map((day) => (
                <div key={day} className="text-center py-2.5 text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px]">
                  {day}
                </div>
              ))}
            </div>

            {/* Date cells */}
            <div className="grid grid-cols-7">
              {/* Empty cells before first day */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-[var(--border)] bg-[var(--surface2)]" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1;
                const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const dayTasks = getTasksForDate(d);

                return (
                  <div
                    key={d}
                    className={`min-h-[80px] border-b border-r border-[var(--border)] p-1.5 transition-colors hover:bg-[var(--row-hover)] ${isToday ? 'bg-[rgba(1,118,211,.04)]' : ''}`}
                  >
                    <div className={`text-[12px] font-semibold mb-1 ${isToday ? 'text-[var(--sf-blue)]' : 'text-[var(--text)]'}`}>
                      {d}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {dayTasks.slice(0, 3).map((t: any) => (
                        <div
                          key={t.id}
                          className="w-full text-[9px] font-medium px-1.5 py-0.5 rounded truncate"
                          style={{ background: `${PRIORITY_COLORS[t.priority] || '#8E9BAE'}18`, color: PRIORITY_COLORS[t.priority] || '#8E9BAE' }}
                          title={t.title}
                        >
                          {t.title}
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-[9px] text-[var(--text3)]">+{dayTasks.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </FadeIn>

        {/* Legend */}
        <div className="flex gap-4 mt-3 text-[11px] text-[var(--text3)]">
          <span><span className="inline-block w-2 h-2 rounded-full bg-[#C23934] mr-1" />High</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-[#DD7A01] mr-1" />Medium</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-[#8E9BAE] mr-1" />Low</span>
        </div>
      </div>
    </PageTransition>
  );
}
