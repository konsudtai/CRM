'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Heading, Body, Button } from '@thai-smb-crm/ui-components';
import type { Task } from '@thai-smb-crm/shared-types';
import { api } from '@/lib/api';

type SortField = 'dueDate' | 'priority' | 'status';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
const STATUS_ORDER: Record<string, number> = { Overdue: 0, Open: 1, 'In Progress': 2, Completed: 3 };
const STATUS_FILTERS = ['ทั้งหมด', 'Open', 'In Progress', 'Completed', 'Overdue'];

function isOverdue(task: Task): boolean {
  return task.status !== 'Completed' && new Date(task.dueDate) < new Date(new Date().toDateString());
}

function priorityLabel(p: string) {
  switch (p) { case 'High': return 'สูง'; case 'Medium': return 'กลาง'; case 'Low': return 'ต่ำ'; default: return p; }
}

function statusLabel(s: string) {
  switch (s) { case 'Open': return 'เปิด'; case 'In Progress': return 'กำลังดำเนินการ'; case 'Completed': return 'เสร็จสิ้น'; case 'Overdue': return 'เกินกำหนด'; default: return s; }
}

export default function TasksPage() {
  const [statusFilter, setStatusFilter] = useState('ทั้งหมด');
  const [sortField, setSortField] = useState<SortField>('dueDate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showCallLog, setShowCallLog] = useState(false);
  const [callDuration, setCallDuration] = useState('');
  const [callOutcome, setCallOutcome] = useState('Connected');
  const [callNotes, setCallNotes] = useState('');
  const [callAccountId, setCallAccountId] = useState('');
  const [callContactId, setCallContactId] = useState('');

  const { data, isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', statusFilter],
    queryFn: () => api('/tasks', { params: statusFilter !== 'ทั้งหมด' ? { status: statusFilter } : {} }),
    placeholderData: [],
  });

  const tasks = useMemo(() => {
    const list = (data ?? []).map(t => ({ ...t, status: isOverdue(t) ? 'Overdue' as const : t.status }));
    const filtered = statusFilter === 'ทั้งหมด' ? list : list.filter(t => t.status === statusFilter);
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'dueDate': cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); break;
        case 'priority': cmp = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9); break;
        case 'status': cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, statusFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }
  const sortIcon = (field: SortField) => sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  async function handleCallLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/activities/calls', {
        method: 'POST',
        body: JSON.stringify({ duration: Number(callDuration), outcome: callOutcome, notes: callNotes, accountId: callAccountId || undefined, contactId: callContactId || undefined }),
      });
      setShowCallLog(false); setCallDuration(''); setCallOutcome('Connected'); setCallNotes(''); setCallAccountId(''); setCallContactId('');
    } catch { /* handled by api layer */ }
  }

  return (
    <div className="apple-page">
      <div className="apple-page-header">
        <div>
          <Heading as="h1" size="section">งานและกิจกรรม</Heading>
          <Body size="small" className="mt-1 !text-[rgba(0,0,0,0.48)]">จัดการงาน นัดหมาย และบันทึกการโทร</Body>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowCallLog(true)}>📞 บันทึกการโทร</Button>
          <a href="/calendar"><Button variant="secondary">📅 ปฏิทิน</Button></a>
          <a href="/tasks/new"><Button variant="primary">+ สร้างงาน</Button></a>
        </div>
      </div>

      {/* Status filter */}
      <div className="apple-filter-bar mb-5">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={statusFilter === s ? 'apple-filter-btn-active' : 'apple-filter-btn'}>
            {s === 'ทั้งหมด' ? s : statusLabel(s)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Body size="small" className="py-12 text-center !text-[rgba(0,0,0,0.48)]">กำลังโหลด...</Body>
      ) : (
        <Card>
          {tasks.length === 0 ? (
            <Body size="small" className="py-12 text-center !text-[rgba(0,0,0,0.48)]">ไม่พบงาน</Body>
          ) : (
            <div className="overflow-x-auto">
              <table className="apple-table">
                <thead>
                  <tr>
                    <th>ชื่องาน</th>
                    <th className="cursor-pointer hover:text-[#0071e3]" onClick={() => toggleSort('dueDate')}>วันครบกำหนด{sortIcon('dueDate')}</th>
                    <th className="cursor-pointer hover:text-[#0071e3]" onClick={() => toggleSort('priority')}>ความสำคัญ{sortIcon('priority')}</th>
                    <th className="cursor-pointer hover:text-[#0071e3]" onClick={() => toggleSort('status')}>สถานะ{sortIcon('status')}</th>
                    <th>เชื่อมโยง</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(t => {
                    const overdue = t.status === 'Overdue';
                    return (
                      <tr key={t.id} className={overdue ? '!bg-red-50/50' : ''}>
                        <td className={overdue ? 'font-medium !text-red-700' : 'font-medium text-[#1d1d1f]'}>
                          {t.title}
                          {t.description && <span className="ml-2 text-[12px] text-[rgba(0,0,0,0.48)]">{t.description.slice(0, 40)}{t.description.length > 40 ? '...' : ''}</span>}
                        </td>
                        <td className={overdue ? 'font-semibold !text-red-600' : '!text-[rgba(0,0,0,0.8)]'}>
                          {new Date(t.dueDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td>
                          <span className={`apple-badge ${t.priority === 'High' ? 'bg-red-100 text-red-700' : t.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-black/[0.06] text-[rgba(0,0,0,0.48)]'}`}>
                            {priorityLabel(t.priority)}
                          </span>
                        </td>
                        <td>
                          <span className={`apple-badge ${overdue ? 'bg-red-100 text-red-700' : t.status === 'Completed' ? 'bg-green-100 text-green-700' : t.status === 'In Progress' ? 'bg-[#0071e3]/10 text-[#0071e3]' : 'bg-black/[0.06] text-[rgba(0,0,0,0.48)]'}`}>
                            {statusLabel(t.status)}
                          </span>
                        </td>
                        <td className="text-[12px] !text-[rgba(0,0,0,0.48)]">
                          {t.accountId && <span className="mr-1">🏢</span>}
                          {t.contactId && <span className="mr-1">👤</span>}
                          {t.opportunityId && <span>💼</span>}
                          {!t.accountId && !t.contactId && !t.opportunityId && '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Call Logging Modal — Apple glass style */}
      {showCallLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[12px] bg-white p-6 shadow-[3px_5px_30px_0px_rgba(0,0,0,0.22)]">
            <div className="mb-5 flex items-center justify-between">
              <Heading as="h3" size="title">บันทึกการโทร</Heading>
              <button onClick={() => setShowCallLog(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-[rgba(0,0,0,0.48)] transition-colors hover:bg-black/[0.04] hover:text-[#1d1d1f]">✕</button>
            </div>
            <form onSubmit={handleCallLogSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block font-sf-pro-text text-[12px] font-semibold tracking-[-0.12px] text-[rgba(0,0,0,0.8)]">ระยะเวลา (นาที) *</label>
                <input type="number" min="1" required value={callDuration} onChange={e => setCallDuration(e.target.value)} className="apple-input" placeholder="เช่น 15" />
              </div>
              <div>
                <label className="mb-1.5 block font-sf-pro-text text-[12px] font-semibold tracking-[-0.12px] text-[rgba(0,0,0,0.8)]">ผลการโทร *</label>
                <select value={callOutcome} onChange={e => setCallOutcome(e.target.value)} className="apple-input">
                  <option value="Connected">ติดต่อได้</option>
                  <option value="No Answer">ไม่รับสาย</option>
                  <option value="Left Message">ฝากข้อความ</option>
                  <option value="Busy">สายไม่ว่าง</option>
                  <option value="Wrong Number">หมายเลขผิด</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block font-sf-pro-text text-[12px] font-semibold tracking-[-0.12px] text-[rgba(0,0,0,0.8)]">บัญชีลูกค้า (ID)</label>
                <input type="text" value={callAccountId} onChange={e => setCallAccountId(e.target.value)} className="apple-input" placeholder="Account ID (ไม่บังคับ)" />
              </div>
              <div>
                <label className="mb-1.5 block font-sf-pro-text text-[12px] font-semibold tracking-[-0.12px] text-[rgba(0,0,0,0.8)]">ผู้ติดต่อ (ID)</label>
                <input type="text" value={callContactId} onChange={e => setCallContactId(e.target.value)} className="apple-input" placeholder="Contact ID (ไม่บังคับ)" />
              </div>
              <div>
                <label className="mb-1.5 block font-sf-pro-text text-[12px] font-semibold tracking-[-0.12px] text-[rgba(0,0,0,0.8)]">บันทึก</label>
                <textarea value={callNotes} onChange={e => setCallNotes(e.target.value)} rows={3} className="apple-input" placeholder="รายละเอียดการโทร..." />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" type="button" onClick={() => setShowCallLog(false)}>ยกเลิก</Button>
                <Button variant="primary" type="submit">บันทึก</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
