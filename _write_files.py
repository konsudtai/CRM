#!/usr/bin/env python3
"""Helper script to write all task files."""
import os

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Wrote {path} ({len(content)} bytes)")

# ============================================================
# TASK 15.7: Quotation pages
# ============================================================

write_file('apps/web-crm/src/app/(quotation)/quotations/page.tsx', r"""'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Heading, Body, Button } from '@thai-smb-crm/ui-components';
import { formatBaht } from '@thai-smb-crm/utils';
import type { Quotation } from '@thai-smb-crm/shared-types';
import { api } from '@/lib/api';

const STATUSES = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'draft', label: 'ร่าง' },
  { key: 'pending_approval', label: 'รออนุมัติ' },
  { key: 'sent', label: 'ส่งแล้ว' },
  { key: 'accepted', label: 'ยอมรับ' },
  { key: 'rejected', label: 'ปฏิเสธ' },
  { key: 'expired', label: 'หมดอายุ' },
];

const statusColor: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-orange-100 text-orange-700',
};

export default function QuotationsPage() {
  const [filter, setFilter] = useState('all');

  const { data, isLoading } = useQuery<Quotation[]>({
    queryKey: ['quotations', filter],
    queryFn: () => api('/quotations', { params: filter !== 'all' ? { status: filter } : {} }),
    placeholderData: [],
  });
  const quotations = data ?? [];

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Heading as="h1" size="headline">ใบเสนอราคา</Heading>
          <Body size="small" className="mt-1 text-gray-500">สร้างและจัดการใบเสนอราคา</Body>
        </div>
        <a href="/quotations/new"><Button variant="primary">+ สร้างใบเสนอราคา</Button></a>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-white p-1">
        {STATUSES.map((s) => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${filter === s.key ? 'bg-[#0071e3] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Body size="small" className="py-12 text-center text-gray-400">กำลังโหลด...</Body>
      ) : (
        <Card>
          {quotations.length === 0 ? (
            <Body size="small" className="py-12 text-center text-gray-400">ไม่พบใบเสนอราคา</Body>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 text-xs font-medium text-gray-500">เลขที่</th>
                    <th className="pb-3 text-xs font-medium text-gray-500">สถานะ</th>
                    <th className="pb-3 text-xs font-medium text-gray-500">ยอดรวม</th>
                    <th className="pb-3 text-xs font-medium text-gray-500">VAT 7%</th>
                    <th className="pb-3 text-xs font-medium text-gray-500">WHT</th>
                    <th className="pb-3 text-xs font-medium text-gray-500">ยอดสุทธิ</th>
                    <th className="pb-3 text-xs font-medium text-gray-500">วันที่สร้าง</th>
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((q) => (
                    <tr key={q.id} className="border-b border-gray-100 hover:bg-white/60">
                      <td className="py-3 pr-4 text-sm font-medium text-[#0066cc]">
                        <a href={`/quotations/${q.id}`}>{q.quotationNumber || '-'}</a>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor[q.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUSES.find((s) => s.key === q.status)?.label ?? q.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-sm">{formatBaht(q.subtotal)}</td>
                      <td className="py-3 pr-4 text-sm">{formatBaht(q.vatAmount)}</td>
                      <td className="py-3 pr-4 text-sm text-red-500">-{formatBaht(q.whtAmount)}</td>
                      <td className="py-3 pr-4 text-sm font-semibold text-[#0071e3]">{formatBaht(q.grandTotal)}</td>
                      <td className="py-3 text-sm text-gray-500">{new Date(q.createdAt).toLocaleDateString('th-TH')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
""")
