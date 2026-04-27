'use client';

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
  draft: 'bg-black/[0.06] text-[rgba(0,0,0,0.48)]',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-[#0071e3]/10 text-[#0071e3]',
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
    <div className="apple-page">
      <div className="apple-page-header">
        <div>
          <Heading as="h1" size="section">ใบเสนอราคา</Heading>
          <Body size="small" className="mt-1 !text-[rgba(0,0,0,0.48)]">
            สร้างและจัดการใบเสนอราคา
          </Body>
        </div>
        <a href="/quotations/new">
          <Button variant="primary">+ สร้างใบเสนอราคา</Button>
        </a>
      </div>

      <div className="apple-filter-bar mb-5">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={filter === s.key ? 'apple-filter-btn-active' : 'apple-filter-btn'}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Body size="small" className="py-12 text-center !text-[rgba(0,0,0,0.48)]">กำลังโหลด...</Body>
      ) : (
        <Card>
          {quotations.length === 0 ? (
            <Body size="small" className="py-12 text-center !text-[rgba(0,0,0,0.48)]">ไม่พบใบเสนอราคา</Body>
          ) : (
            <div className="overflow-x-auto">
              <table className="apple-table">
                <thead>
                  <tr>
                    <th>เลขที่</th>
                    <th>สถานะ</th>
                    <th>ยอดรวม</th>
                    <th>VAT 7%</th>
                    <th>WHT</th>
                    <th>ยอดสุทธิ</th>
                    <th>วันที่สร้าง</th>
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((q) => (
                    <tr key={q.id}>
                      <td>
                        <a href={`/quotations/${q.id}`} className="font-medium text-[#0066cc] hover:underline">
                          {q.quotationNumber || '-'}
                        </a>
                      </td>
                      <td>
                        <span className={`apple-badge ${statusColor[q.status] ?? 'bg-black/[0.06] text-[rgba(0,0,0,0.48)]'}`}>
                          {STATUSES.find((s) => s.key === q.status)?.label ?? q.status}
                        </span>
                      </td>
                      <td>{formatBaht(q.subtotal)}</td>
                      <td>{formatBaht(q.vatAmount)}</td>
                      <td className="text-red-600">-{formatBaht(q.whtAmount)}</td>
                      <td className="font-semibold text-[#0071e3]">{formatBaht(q.grandTotal)}</td>
                      <td className="!text-[rgba(0,0,0,0.48)]">
                        {new Date(q.createdAt).toLocaleDateString('th-TH')}
                      </td>
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
