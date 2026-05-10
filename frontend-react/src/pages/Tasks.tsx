import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageTransition, FadeIn } from '@/components/motion';
import { motion } from 'framer-motion';

function fmt(n: number) {
  if (n >= 1e6) return `฿${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `฿${(n / 1e3).toFixed(0)}K`;
  return `฿${n.toLocaleString()}`;
}

type SortKey = 'title' | 'due_date' | 'priority' | 'status';
type SortDir = 'asc' | 'desc';

const priorityOrder: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
const statusOrder: Record<string, number> = { Overdue: 4, 'In Progress': 3, Open: 2, Completed: 1 };

const priorityColors: Record<string, { bg: string; text: string }> = {
  High: { bg: 'rgba(194,57,52,.1)', text: '#C23934' },
  Medium: { bg: 'rgba(217,119,6,.1)', text: '#D97706' },
  Low: { bg: 'rgba(100,116,139,.1)', text: '#64748B' },
};

const statusColors: Record<string, { bg: string; text: string }> = {
  Overdue: { bg: 'rgba(194,57,52,.1)', text: '#C23934' },
  Completed: { bg: 'rgba(46,132,74,.1)', text: '#2E844A' },
  'In Progress': { bg: 'rgba(1,118,211,.1)', text: '#0176D3' },
  Open: { bg: 'rgba(100,116,139,.1)', text: '#64748B' },
};

const FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'Open', label: 'Open' },
  { key: 'In Progress', label: 'In Progress' },
  { key: 'Completed', label: 'Completed' },
  { key: 'Overdue', label: 'Overdue' },
];

export function TasksPage() {
  const [filter, setFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('due_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const { data } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api('/tasks'),
  });

  const allTasks = (Array.isArray(data) ? data : data?.data || []).map((t: any) => {
    const isOverdue = t.due_date && t.status !== 'Completed' && new Date(t.due_date) < new Date();
    return { ...t, displayStatus: isOverdue ? 'Overdue' : t.status };
  });

  const filtered = useMemo(() => {
    let list = filter === 'all' ? allTasks : allTasks.filter((t: any) => t.displayStatus === filter);

    list.sort((a: any, b: any) => {
      let cmp = 0;
      switch (sortKey) {
        case 'title':
          cmp = (a.title || '').localeCompare(b.title || '');
          break;
        case 'due_date':
          cmp = (a.due_date || '9999').localeCompare(b.due_date || '9999');
          break;
        case 'priority':
          cmp = (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
          break;
        case 'status':
          cmp = (statusOrder[a.displayStatus] || 0) - (statusOrder[b.displayStatus] || 0);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [allTasks, filter, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-[var(--text3)] ml-0.5">↕</span>;
    return <span className="text-[var(--sf-blue)] ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <PageTransition>
      <div className="px-5 py-5 max-w-[1400px] mx-auto">
        <FadeIn direction="down">
          <div className="mb-5">
            <h1 className="text-[22px] font-bold text-[var(--text)]">Tasks & Activities</h1>
            <p className="text-[12px] text-[var(--text3)] mt-0.5">Manage tasks, appointments and call logs</p>
          </div>
        </FadeIn>

        {/* Filter Bar */}
        <FadeIn delay={0.1}>
          <div className="flex gap-1 bg-[rgba(3,45,96,.05)] rounded-lg p-1 mb-4 w-fit">
            {FILTERS.map((f) => (
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
                    <th
                      onClick={() => handleSort('title')}
                      className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)] cursor-pointer select-none hover:text-[var(--sf-blue)]"
                    >
                      ชื่องาน <SortIcon col="title" />
                    </th>
                    <th
                      onClick={() => handleSort('due_date')}
                      className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)] cursor-pointer select-none hover:text-[var(--sf-blue)]"
                    >
                      วันครบกำหนด <SortIcon col="due_date" />
                    </th>
                    <th
                      onClick={() => handleSort('priority')}
                      className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)] cursor-pointer select-none hover:text-[var(--sf-blue)]"
                    >
                      ความสำคัญ <SortIcon col="priority" />
                    </th>
                    <th
                      onClick={() => handleSort('status')}
                      className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-[.3px] text-left pb-2.5 border-b-2 border-[var(--border)] cursor-pointer select-none hover:text-[var(--sf-blue)]"
                    >
                      สถานะ <SortIcon col="status" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center text-[var(--text3)] py-8 text-[12px]">No tasks found</td>
                    </tr>
                  ) : (
                    filtered.map((t: any) => {
                      const isOverdue = t.displayStatus === 'Overdue';
                      const pc = priorityColors[t.priority] || priorityColors.Medium;
                      const sc = statusColors[t.displayStatus] || statusColors.Open;
                      return (
                        <motion.tr
                          key={t.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={isOverdue ? 'bg-red-50/50' : 'hover:bg-[rgba(1,118,211,.02)]'}
                        >
                          <td className={`py-2.5 border-b border-[var(--border)] text-[12px] font-semibold ${isOverdue ? 'text-red-700' : 'text-[var(--text)]'}`}>
                            {t.title}
                          </td>
                          <td className={`py-2.5 border-b border-[var(--border)] text-[12px] ${isOverdue ? 'font-semibold text-red-700' : 'text-[var(--text2)]'}`}>
                            {formatDate(t.due_date)}
                          </td>
                          <td className="py-2.5 border-b border-[var(--border)]">
                            <span
                              className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: pc.bg, color: pc.text }}
                            >
                              {t.priority}
                            </span>
                          </td>
                          <td className="py-2.5 border-b border-[var(--border)]">
                            <span
                              className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: sc.bg, color: sc.text }}
                            >
                              {t.displayStatus}
                            </span>
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
