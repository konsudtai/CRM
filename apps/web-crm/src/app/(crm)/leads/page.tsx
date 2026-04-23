'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Heading, Body, Button } from '@thai-smb-crm/ui-components';
import type { Lead } from '@thai-smb-crm/shared-types';
import { api } from '@/lib/api';

const STATUSES = ['ทั้งหมด', 'New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];

export default function LeadsPage() {
  const [status, setStatus] = useState('ทั้งหมด');
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  const { data, isLoading } = useQuery<Lead[]>({
    queryKey: ['leads', status],
    queryFn: () => api('/leads', { params: status !== 'ทั้งหมด' ? { status } : {} }),
    placeholderData: [],
  });
  const leads = data ?? [];

  const kanbanStatuses = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
  const grouped = kanbanStatuses.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.status === s);
    return acc;
  }, {} as Record<string, Lead[]>);

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Heading as="h1" size="headline">ลีด</Heading>
          <Body size="small" className="mt-1 text-gray-500">จัดการลีดและติดตามสถานะ</Body>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg bg-white p-1">
            <button onClick={() => setView('kanban')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${view === 'kanban' ? 'bg-[#0071e3] text-white' : 'text-gray-600'}`}>Kanban</button>
            <button onClick={() => setView('list')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${view === 'list' ? 'bg-[#0071e3] text-white' : 'text-gray-600'}`}>รายการ</button>
          </div>
          <Button variant="primary">+ สร้างลีด</Button>
        </div>
      </div>

      {view === 'list' && (
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-white p-1">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${status === s ? 'bg-[#0071e3] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{s}</button>
          ))}
        </div>
      )}

      {isLoading ? (
        <Body size="small" className="py-12 text-center text-gray-400">กำลังโหลด...</Body>
      ) : view === 'kanban' ? (
        <div className="grid auto-cols-[260px] grid-flow-col gap-4 overflow-x-auto pb-4">
          {kanbanStatuses.map(s => (
            <div key={s} className="rounded-lg bg-white/60 p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1d1d1f]">{s}</span>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] text-gray-600">{grouped[s]?.length ?? 0}</span>
              </div>
              <div className="space-y-2">
                {(grouped[s] ?? []).map(lead => (
                  <Card key={lead.id} className="!p-3">
                    <span className="text-sm font-medium text-[#1d1d1f]">{lead.name}</span>
                    {lead.companyName && <Body size="caption" className="text-gray-500">{lead.companyName}</Body>}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">{lead.source}</span>
                      {lead.aiScore != null && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${lead.aiScore >= 70 ? 'bg-green-100 text-green-700' : lead.aiScore >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                          AI: {lead.aiScore}
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
                {(grouped[s] ?? []).length === 0 && (
                  <Body size="caption" className="py-4 text-center text-gray-300">ว่าง</Body>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          {leads.length === 0 ? (
            <Body size="small" className="py-12 text-center text-gray-400">ไม่พบลีด</Body>
          ) : (
            <table className="w-full text-left">
              <thead><tr className="border-b border-gray-200">
                <th className="pb-3 text-xs font-medium text-gray-500">ชื่อ</th>
                <th className="pb-3 text-xs font-medium text-gray-500">บริษัท</th>
                <th className="pb-3 text-xs font-medium text-gray-500">สถานะ</th>
                <th className="pb-3 text-xs font-medium text-gray-500">แหล่งที่มา</th>
                <th className="pb-3 text-xs font-medium text-gray-500">AI Score</th>
              </tr></thead>
              <tbody>{leads.map(l => (
                <tr key={l.id} className="border-b border-gray-100 hover:bg-white/60">
                  <td className="py-3 pr-4 text-sm font-medium text-[#0066cc]">{l.name}</td>
                  <td className="py-3 pr-4 text-sm">{l.companyName || '-'}</td>
                  <td className="py-3 pr-4"><span className="rounded-full bg-[#0071e3]/10 px-2 py-0.5 text-[10px] text-[#0071e3]">{l.status}</span></td>
                  <td className="py-3 pr-4 text-sm text-gray-500">{l.source}</td>
                  <td className="py-3 text-sm">{l.aiScore ?? '-'}</td>
                </tr>))}</tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
