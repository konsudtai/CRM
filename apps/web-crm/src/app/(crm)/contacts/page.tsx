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
    <div className="apple-page">
      <div className="apple-page-header">
        <div>
          <Heading as="h1" size="section">ผู้ติดต่อ</Heading>
          <Body size="small" className="mt-1 !text-[rgba(0,0,0,0.48)]">
            รายชื่อผู้ติดต่อทั้งหมด
          </Body>
        </div>
        <Button variant="primary">+ เพิ่มผู้ติดต่อ</Button>
      </div>

      <Card>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="ค้นหาชื่อ, อีเมล, โทรศัพท์..."
          className="apple-input mb-5"
        />

        {isLoading ? (
          <Body size="small" className="py-12 text-center !text-[rgba(0,0,0,0.48)]">กำลังโหลด...</Body>
        ) : contacts.length === 0 ? (
          <Body size="small" className="py-12 text-center !text-[rgba(0,0,0,0.48)]">ไม่พบผู้ติดต่อ</Body>
        ) : (
          <div className="overflow-x-auto">
            <table className="apple-table">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>ตำแหน่ง</th>
                  <th>อีเมล</th>
                  <th>โทรศัพท์</th>
                  <th>LINE ID</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-[#1d1d1f]">{c.firstName} {c.lastName}</td>
                    <td className="text-[rgba(0,0,0,0.8)]">{c.title || '-'}</td>
                    <td>{c.email || '-'}</td>
                    <td>{c.phone || '-'}</td>
                    <td>{c.lineId || '-'}</td>
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
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="apple-filter-btn disabled:opacity-40">ก่อนหน้า</button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="apple-filter-btn disabled:opacity-40">ถัดไป</button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
