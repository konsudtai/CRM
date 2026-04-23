'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Heading, Body, Button } from '@thai-smb-crm/ui-components';
import { formatThaiAddress } from '@thai-smb-crm/utils';
import type { Account, Contact, TimelineEntry } from '@thai-smb-crm/shared-types';
import { api } from '@/lib/api';

type Tab = 'info' | 'contacts' | 'timeline' | 'notes' | 'tags';

export default function AccountDetailPage({ params }: { params: { id: string } }) {
  const [tab, setTab] = useState<Tab>('info');

  const { data: account } = useQuery<Account>({
    queryKey: ['account', params.id],
    queryFn: () => api(`/accounts/${params.id}`),
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['account-contacts', params.id],
    queryFn: () => api(`/accounts/${params.id}/contacts`),
    enabled: tab === 'contacts',
    placeholderData: [],
  });

  const { data: timeline } = useQuery<TimelineEntry[]>({
    queryKey: ['account-timeline', params.id],
    queryFn: () => api(`/accounts/${params.id}/timeline`),
    enabled: tab === 'timeline',
    placeholderData: [],
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info', label: 'ข้อมูลบริษัท' },
    { key: 'contacts', label: 'ผู้ติดต่อ' },
    { key: 'timeline', label: 'ไทม์ไลน์' },
    { key: 'notes', label: 'บันทึก' },
    { key: 'tags', label: 'แท็ก' },
  ];

  if (!account) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7]">
        <Body size="default" className="text-gray-400">กำลังโหลด...</Body>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-6 md:p-8">
      <div className="mb-6">
        <a href="/accounts" className="text-sm text-[#0066cc] hover:underline">← บัญชีลูกค้า</a>
        <Heading as="h1" size="headline" className="mt-2">{account.companyName}</Heading>
        <Body size="small" className="text-gray-500">{account.industry}</Body>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg bg-white p-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-xs font-medium transition-colors ${
              tab === t.key ? 'bg-[#0071e3] text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}>{t.label}</button>
        ))}
      </div>

      {tab === 'info' && (
        <Card>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Body size="small" className="font-medium text-gray-500">อีเมล</Body>
              <Body size="default">{account.email || '-'}</Body>
            </div>
            <div>
              <Body size="small" className="font-medium text-gray-500">โทรศัพท์</Body>
              <Body size="default">{account.phone || '-'}</Body>
            </div>
            <div>
              <Body size="small" className="font-medium text-gray-500">เว็บไซต์</Body>
              <Body size="default">{account.website || '-'}</Body>
            </div>
            <div>
              <Body size="small" className="font-medium text-gray-500">เลขประจำตัวผู้เสียภาษี</Body>
              <Body size="default">{account.taxId || '-'}</Body>
            </div>
            <div className="md:col-span-2">
              <Body size="small" className="font-medium text-gray-500">ที่อยู่</Body>
              <Body size="default">{formatThaiAddress(account.address)}</Body>
            </div>
          </div>
        </Card>
      )}

      {tab === 'contacts' && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <Body size="small" className="font-medium text-gray-500">ผู้ติดต่อ</Body>
            <Button variant="secondary">+ เพิ่มผู้ติดต่อ</Button>
          </div>
          {(contacts ?? []).length === 0 ? (
            <Body size="small" className="py-8 text-center text-gray-400">ยังไม่มีผู้ติดต่อ</Body>
          ) : (
            <div className="space-y-3">
              {(contacts ?? []).map(c => (
                <div key={c.id} className="flex items-center justify-between rounded-lg bg-white p-4">
                  <div>
                    <span className="text-sm font-medium text-[#1d1d1f]">{c.firstName} {c.lastName}</span>
                    {c.title && <span className="ml-2 text-xs text-gray-400">{c.title}</span>}
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    {c.email && <span>{c.email}</span>}
                    {c.phone && <span>{c.phone}</span>}
                    {c.lineId && <span>LINE: {c.lineId}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'timeline' && (
        <Card>
          {(timeline ?? []).length === 0 ? (
            <Body size="small" className="py-8 text-center text-gray-400">ยังไม่มีกิจกรรม</Body>
          ) : (
            <div className="space-y-4">
              {(timeline ?? []).map(entry => (
                <div key={entry.id} className="flex gap-4 border-l-2 border-[#0071e3]/20 pl-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-[#0071e3]/10 px-2 py-0.5 text-[10px] font-medium text-[#0071e3]">{entry.entityType}</span>
                      <span className="text-xs text-gray-400">{new Date(entry.timestamp).toLocaleString('th-TH')}</span>
                    </div>
                    <Body size="small" className="mt-1">{entry.summary}</Body>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'notes' && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <Body size="small" className="font-medium text-gray-500">บันทึก</Body>
            <Button variant="secondary">+ เพิ่มบันทึก</Button>
          </div>
          <Body size="small" className="py-8 text-center text-gray-400">ยังไม่มีบันทึก</Body>
        </Card>
      )}

      {tab === 'tags' && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <Body size="small" className="font-medium text-gray-500">แท็ก</Body>
            <Button variant="secondary">+ เพิ่มแท็ก</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {account.tags.map(t => (
              <span key={t} className="rounded-full bg-[#0071e3]/10 px-3 py-1 text-sm text-[#0071e3]">{t}</span>
            ))}
            {account.tags.length === 0 && (
              <Body size="small" className="py-8 text-center text-gray-400">ยังไม่มีแท็ก</Body>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
