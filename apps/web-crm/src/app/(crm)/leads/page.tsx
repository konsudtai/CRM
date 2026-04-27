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
    acc[s] = leads.filter((l) => l.status === s);
    return acc;
  }, {} as Record<string, Lead[]>);

  return (
    <div className="apple-page">
      <div className="apple-page-header">
        <div>
          <Heading as="h1" size="section">ลีด</Heading>
          <Body size="small" className="mt-1 !text-[rgba(0,0,0,0.48)]">
            จัดการลีดและติดตามสถานะ
          </Body>
        </div>
        <div className="flex gap-3">
          <div className="apple-filter-bar">
            <button
              onClick={() => setView('kanban')}
              className={view === 'kanban' ? 'apple-filter-btn-active' : 'apple-filter-btn'}
            >
              Kanban
            </button>
            <button
              onClick={() => setView('list')}
              className={view === 'list' ? 'apple-filter-btn-active' : 'apple-filter-btn'}
            >
              รายการ
            </button>
          </div>
          <Button variant="primary">+ สร้างลีด</Button>
        </div>
      </div>

      {/* Status filter for list view */}
      {view === 'list' && (
        <div className="apple-filter-bar mb-5">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={status === s ? 'apple-filter-btn-active' : 'apple-filter-btn'}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <Body size="small" className="py-12 text-center !text-[rgba(0,0,0,0.48)]">กำลังโหลด...</Body>
      ) : view === 'kanban' ? (
        /* Kanban Board */
        <div className="grid auto-cols-[260px] grid-flow-col gap-4 overflow-x-auto pb-4">
          {kanbanStatuses.map((s) => (
            <div key={s} className="rounded-[8px] bg-white/60 p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-sf-pro-text text-[14px] font-semibold tracking-[-0.224px] text-[#1d1d1f]">
                  {s}
                </span>
                <span className="apple-badge bg-black/[0.06] text-[rgba(0,0,0,0.48)]">
                  {grouped[s]?.length ?? 0}
                </span>
              </div>
              <div className="space-y-2">
                {(grouped[s] ?? []).map((lead) => (
                  <Card key={lead.id} className="!p-3">
                    <span className="font-sf-pro-text text-[14px] font-medium tracking-[-0.224px] text-[#1d1d1f]">
                      {lead.name}
                    </span>
                    {lead.companyName && (
                      <Body size="caption" className="!text-[rgba(0,0,0,0.48)]">{lead.companyName}</Body>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-sf-pro-text text-[10px] tracking-[-0.08px] text-[rgba(0,0,0,0.48)]">
                        {lead.source}
                      </span>
                      {lead.aiScore != null && (
                        <span className={`apple-badge ${
                          lead.aiScore >= 70
                            ? 'bg-green-100 text-green-700'
                            : lead.aiScore >= 40
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-black/[0.06] text-[rgba(0,0,0,0.48)]'
                        }`}>
                          AI: {lead.aiScore}
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
                {(grouped[s] ?? []).length === 0 && (
                  <Body size="caption" className="py-4 text-center !text-[rgba(0,0,0,0.2)]">ว่าง</Body>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <Card>
          {leads.length === 0 ? (
            <Body size="small" className="py-12 text-center !text-[rgba(0,0,0,0.48)]">ไม่พบลีด</Body>
          ) : (
            <table className="apple-table">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>บริษัท</th>
                  <th>สถานะ</th>
                  <th>แหล่งที่มา</th>
                  <th>AI Score</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td className="font-medium text-[#0066cc]">{l.name}</td>
                    <td>{l.companyName || '-'}</td>
                    <td><span className="apple-badge-blue">{l.status}</span></td>
                    <td className="!text-[rgba(0,0,0,0.48)]">{l.source}</td>
                    <td>{l.aiScore ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
