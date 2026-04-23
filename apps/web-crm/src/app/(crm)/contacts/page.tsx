'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Heading, Body, Button } from '@thai-smb-crm/ui-components';
import type { Contact } from '@thai-smb-crm/shared-types';
import { api } from '@/lib/api';

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery<{ items: Contact[]; total: number }>({
    queryKey: ['contacts', search, page],
    queryFn: () => api('/contacts', { params: { search, page: String(page), limit: '20' } }),
    placeholderData: { items: [], total: 0 },
  });
  const contacts = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Heading as="h1" size="headline">ผู้ติดต่อ</Heading>
          <Body size="small" className="mt-1 text-gray-500">รายชื่อผู้ติดต่อทั้งหมด</Body>
        </div>
        <Button variant="primary">+ เพิ่มผู้ติดต่อ</Button>
      </div>
      <Card>
        <input type="text" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="ค้นหาชื่อ, อีเมล, โทรศัพท์..."
          className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-[#0071e3] focus:outline-none focus:ring-1 focus:ring-[#0071e3]" />
        {isLoading ? (
          <Body size="small" className="py-12 text-center text-gray-400">กำลังโหลด...</Body>
        ) : contacts.length === 0 ? (
          <Body size="small" className="py-12 text-center text-gray-400">ไม่พบผู้ติดต่อ</Body>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="border-b border-gray-200">
                <th className="pb-3 text-xs font-medium text-gray-500">ชื่อ</th>
                <th className="pb-3 text-xs font-medium text-gray-500">ตำแหน่ง</th>
                <th className="pb-3 text-xs font-medium text-gray-500">อีเมล</th>
                <th className="pb-3 text-xs font-medium text-gray-500">โทรศัพท์</th>
                <th className="pb-3 text-xs font-medium text-gray-500">LINE ID</th>
              </tr></thead>
              <tbody>{contacts.map(c => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-white/60">
                  <td className="py-3 pr-4 text-sm font-medium text-[#1d1d1f]">{c.firstName} {c.lastName}</td>
                  <td className="py-3 pr-4 text-sm text-gray-600">{c.title || '-'}</td>
                  <td className="py-3 pr-4 text-sm">{c.email || '-'}</td>
                  <td className="py-3 pr-4 text-sm">{c.phone || '-'}</td>
                  <td className="py-3 text-sm">{c.lineId || '-'}</td>
                </tr>))}</tbody>
            </table>
            {totalPages > 1 && <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-gray-400">หน้า {page}/{totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded border px-3 py-1 text-xs disabled:opacity-40">ก่อนหน้า</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded border px-3 py-1 text-xs disabled:opacity-40">ถัดไป</button>
              </div></div>}
          </div>
        )}
      </Card>
    </div>
  );
}
