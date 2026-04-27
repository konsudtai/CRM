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
    <div className="apple-page">
      <div className="apple-page-header">
        <div>
          <Heading as="h1" size="section">บัญชีลูกค้า</Heading>
          <Body size="small" className="mt-1 !text-[rgba(0,0,0,0.48)]">
            จัดการบัญชีลูกค้าทั้งหมด
          </Body>
        </div>
        <Button variant="primary">+ สร้างบัญชี</Button>
      </div>

      <Card>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="ค้นหาชื่อบริษัท, อีเมล, โทรศัพท์..."
          className="apple-input mb-5"
        />

        {isLoading ? (
          <Body size="small" className="py-12 text-center !text-[rgba(0,0,0,0.48)]">กำลังโหลด...</Body>
        ) : accounts.length === 0 ? (
          <Body size="small" className="py-12 text-center !text-[rgba(0,0,0,0.48)]">ไม่พบบัญชีลูกค้า</Body>
        ) : (
          <div className="overflow-x-auto">
            <table className="apple-table">
              <thead>
                <tr>
                  <th>ชื่อบริษัท</th>
                  <th>อุตสาหกรรม</th>
                  <th>โทรศัพท์</th>
                  <th>ที่อยู่</th>
                  <th>แท็ก</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <a
                        href={`/accounts/${a.id}`}
                        className="font-medium text-[#0066cc] hover:underline"
                      >
                        {a.companyName}
                      </a>
                    </td>
                    <td className="text-[#1d1d1f]">{a.industry}</td>
                    <td className="text-[#1d1d1f]">{a.phone || '-'}</td>
                    <td className="text-[12px] !text-[rgba(0,0,0,0.48)]">
                      {formatThaiAddress(a.address)}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {a.tags.map((t) => (
                          <span key={t} className="apple-badge-blue">{t}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="mt-5 flex items-center justify-between">
                <span className="font-sf-pro-text text-[12px] tracking-[-0.12px] text-[rgba(0,0,0,0.48)]">
                  หน้า {page}/{totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="apple-filter-btn disabled:opacity-40"
                  >
                    ก่อนหน้า
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="apple-filter-btn disabled:opacity-40"
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
