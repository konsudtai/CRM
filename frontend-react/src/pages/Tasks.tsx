import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageTransition, FadeIn, AnimatedCard } from '@/components/motion';

const STATUS_FILTERS = ['ทั้งหมด', 'Open', 'In Progress', 'Completed', 'Overdue'];

export function TasksPage() {
  const [statusFilter, setStatusFilter] = useState('ทั้งหมด');
  const [sortField, setSortField] = useState<'dueDate' | 'priority'>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api('/tasks'),
    placeholderData: [],
  });

  const tasks = useMemo(() => {
    const raw = Array.isArray(data) ? data : data?.data || [];
    const now = new Date().toDateString();
    const list = raw.map((t: any) => ({
      ...t,
      status: t.status !== 'Completed' && new Date(t.due_date || t.dueDate) < new Date(now) ? 'Overdue' : t.status,
    }));
    const filtered = statusFilter === 'ทั้งหมด' ? list : list.filter((t: any) => t.status === statusFilter);
    const priorityOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    return filtered.sort((a: any, b: any) => {
      let cmp = 0;
      if (sortField === 'dueDate') cmp = new Date(a.due_date || a.dueDate).getTime() - new Date(b.due_date || b.dueDate).getTime();
      else cmp = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, statusFilter, sortField, sortDir]);

  function toggleSort(field: 'dueDate' | 'priority') {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <FadeIn direction="down">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">งานและกิจกรรม</h1>
              <p className="text-sm text-slate-500 mt-1">จัดการงาน นัดหมาย และบันทึกการโทร</p>
            </div>
            <button className="px-4 py-2 rounded-xl bg-sf-blue text-white text-sm font-semibold hover:bg-sf-blue-d transition shadow-md shadow-sf-blue/20">
              + สร้างงาน
            </button>
          </div>
        </FadeIn>

        {/* Filters */}
        <div className="flex gap-1.5 mb-5 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                statusFilter === s ? 'bg-white dark:bg-slate-700 text-sf-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-center text-slate-400 py-16">กำลังโหลด...</p>
        ) : (
          <AnimatedCard className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 overflow-hidden">
            {tasks.length === 0 ? (
              <p className="text-center text-slate-400 py-16 text-sm">ไม่พบงาน</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">ชื่องาน</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:text-sf-blue" onClick={() => toggleSort('dueDate')}>
                        วันครบกำหนด {sortField === 'dueDate' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:text-sf-blue" onClick={() => toggleSort('priority')}>
                        ความสำคัญ {sortField === 'priority' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t: any) => {
                      const overdue = t.status === 'Overdue';
                      return (
                        <tr key={t.id} className={`border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${overdue ? 'bg-red-50/50' : ''}`}>
                          <td className={`px-5 py-3 font-medium ${overdue ? 'text-red-700' : 'text-slate-800 dark:text-slate-200'}`}>
                            {t.title}
                          </td>
                          <td className={`px-5 py-3 ${overdue ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                            {new Date(t.due_date || t.dueDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                              t.priority === 'High' ? 'bg-red-50 text-red-700' :
                              t.priority === 'Medium' ? 'bg-amber-50 text-amber-700' :
                              'bg-slate-100 text-slate-500'
                            }`}>
                              {t.priority === 'High' ? 'สูง' : t.priority === 'Medium' ? 'กลาง' : 'ต่ำ'}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                              overdue ? 'bg-red-100 text-red-700' :
                              t.status === 'Completed' ? 'bg-green-50 text-green-700' :
                              t.status === 'In Progress' ? 'bg-blue-50 text-blue-700' :
                              'bg-slate-100 text-slate-500'
                            }`}>
                              {overdue ? 'เกินกำหนด' : t.status === 'Completed' ? 'เสร็จสิ้น' : t.status === 'In Progress' ? 'กำลังดำเนินการ' : 'เปิด'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
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
