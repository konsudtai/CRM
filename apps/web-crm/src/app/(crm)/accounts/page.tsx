'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Heading, Body, Button } from '@thai-smb-crm/ui-components';
import { formatThaiAddress } from '@thai-smb-crm/utils';
import type { Account } from '@thai-smb-crm/shared-types';
import { api } from '@/lib/api';

export default function AccountsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery<{ items: Account[]; total: number }>({
    queryKey: ['accounts', search, page],
    queryFn: () => api('/accounts', { params: { search, page: String(page), limit: '20' } }),
    placeholderData: { items: [], total: 0 },
  });
  const accounts = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Heading as="h1" size="headline">บัญชีลูกค้า</Heading>
          <Body size="small" className="mt-1 text-gray-500">จัดการบัญชีลูกค้าทั้งหมด</Body>
        </div>
        <Button variant="primary">+ สร้างบัญชี</Button>
      </div>
      <Card>
        <input type="text" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="ค้นหาชื่อบริษัท, อีเมล, โทรศัพท์..."
          className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm placeholder:text-gray-400 focus:border-[#0071e3] focus:outline-none focus:ring-1 focus:ring-[#0071e3]" />
        {isLoading ? (
          <Body size="small" className="py-12 text-center text-gray-400">กำลังโหลด...</Body>
        ) : accounts.length === 0 ? (
          <Body size="small" className="py-12 text-center text-gray-400">ไม่พบบัญชีลูกค้า</Body>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="border-b border-gray-200">
                {['ชื่อบริษัท','อุตสาหกรรม','โทรศัพท์','ที่อยู่','แท็ก'].map(h=>(
                  <th key={h} className="pb-3 text-xs font-medium text-gray-500">{h}</th>))}
              </tr></thead>
              <tbody>{accounts.map(a=>(
                <tr key={a.id} className="border-b border-gray-100 hover:bg-white/60">
                  <td className="py-3 pr-4"><a href={`/accounts/${a.id}`} className="text-sm font-medium text-[#0066cc] hover:underline">{a.companyName}</a></td>
                  <td className="py-3 pr-4 text-sm">{a.industry}</td>
                  <td className="py-3 pr-4 text-sm">{a.phone||'-'}</td>
                  <td className="py-3 pr-4 text-xs text-gray-500">{formatThaiAddress(a.address)}</td>
                  <td className="py-3"><div className="flex flex-wrap gap-1">{a.tags.map(t=>
                    <span key={t} className="rounded-full bg-[#0071e3]/10 px-2 py-0.5 text-[10px] text-[#0071e3]">{t}</span>
                  )}</div></td>
                </tr>))}</tbody>
            </table>
            {totalPages>1&&<div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-gray-400">หน้า {page}/{totalPages}</span>
              <div className="flex gap-2">
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="rounded border px-3 py-1 text-xs disabled:opacity-40">ก่อนหน้า</button>
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="rounded border px-3 py-1 text-xs disabled:opacity-40">ถัดไป</button>
              </div></div>}
          </div>
        )}
      </Card>
    </div>
  );
}
