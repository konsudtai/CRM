'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, Heading, Body, Button } from '@thai-smb-crm/ui-components';
import { api } from '@/lib/api';

interface ConsentRecord {
  id: string;
  contactId: string;
  contactName: string;
  purpose: string;
  status: 'granted' | 'withdrawn';
  grantedAt: string;
  expiresAt?: string;
  withdrawnAt?: string;
}

interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string;
  createdAt: string;
}

type PdpaTab = 'consent' | 'audit';

export default function PdpaSettings() {
  const [activeTab, setActiveTab] = useState<PdpaTab>('consent');
  const [deletionContactId, setDeletionContactId] = useState('');

  const { data: consentRecords = [], isLoading: loadingConsent } = useQuery<ConsentRecord[]>({
    queryKey: ['consent-records'],
    queryFn: () => api('/consent'),
    placeholderData: [],
  });

  const { data: auditLogs = [], isLoading: loadingAudit } = useQuery<AuditLogEntry[]>({
    queryKey: ['audit-logs'],
    queryFn: () => api('/audit-logs', { params: { limit: '50' } }),
    enabled: activeTab === 'audit',
    placeholderData: [],
  });

  const deletionMutation = useMutation({
    mutationFn: (contactId: string) =>
      api(`/contacts/${contactId}/pdpa`, { method: 'DELETE' }),
    onSuccess: () => setDeletionContactId(''),
  });

  return (
    <div>
      <div className="mb-6">
        <Heading as="h2" size="title">PDPA</Heading>
        <Body size="small" className="mt-1 text-gray-500">
          จัดการความยินยอมและบันทึกการตรวจสอบตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล
        </Body>
      </div>

      {/* Tab switcher */}
      <div className="mb-4 flex rounded-lg bg-white p-1">
        <button
          onClick={() => setActiveTab('consent')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'consent' ? 'bg-[#0071e3] text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          บันทึกความยินยอม
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'audit' ? 'bg-[#0071e3] text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          บันทึกการตรวจสอบ
        </button>
      </div>

      {activeTab === 'consent' && (
        <>
          {/* Data Deletion Request */}
          <Card className="mb-4">
            <Body size="small" className="mb-2 font-medium text-[#1d1d1f]">ขอลบข้อมูลส่วนบุคคล</Body>
            <Body size="caption" className="mb-3 text-gray-500">
              การลบข้อมูลจะดำเนินการภายใน 30 วันตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล
            </Body>
            <div className="flex gap-2">
              <input
                type="text"
                value={deletionContactId}
                onChange={e => setDeletionContactId(e.target.value)}
                className="flex-1 max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0071e3] focus:outline-none focus:ring-1 focus:ring-[#0071e3]"
                placeholder="กรอก Contact ID"
              />
              <Button
                variant="secondary"
                onClick={() => deletionContactId && deletionMutation.mutate(deletionContactId)}
                disabled={!deletionContactId || deletionMutation.isPending}
                className="!border-red-500 !text-red-500 hover:!bg-red-50"
              >
                {deletionMutation.isPending ? 'กำลังดำเนินการ...' : 'ขอลบข้อมูล'}
              </Button>
            </div>
            {deletionMutation.isSuccess && (
              <Body size="caption" className="mt-2 text-green-600">ส่งคำขอลบข้อมูลสำเร็จ</Body>
            )}
          </Card>

          {/* Consent Records Table */}
          <Card>
            <Body size="small" className="mb-3 font-medium text-[#1d1d1f]">บันทึกความยินยอม</Body>
            {loadingConsent ? (
              <Body size="caption" className="py-8 text-center text-gray-400">กำลังโหลด...</Body>
            ) : consentRecords.length === 0 ? (
              <Body size="caption" className="py-8 text-center text-gray-400">ยังไม่มีบันทึกความยินยอม</Body>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-2 pr-4 text-xs font-medium text-gray-500">ชื่อผู้ติดต่อ</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-gray-500">วัตถุประสงค์</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-gray-500">สถานะ</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-gray-500">วันที่ให้ความยินยอม</th>
                      <th className="pb-2 text-xs font-medium text-gray-500">วันหมดอายุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consentRecords.map(record => (
                      <tr key={record.id} className="border-b border-gray-100">
                        <td className="py-2.5 pr-4 text-sm text-[#1d1d1f]">{record.contactName}</td>
                        <td className="py-2.5 pr-4 text-sm text-gray-600">{record.purpose}</td>
                        <td className="py-2.5 pr-4">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            record.status === 'granted'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {record.status === 'granted' ? 'ให้ความยินยอม' : 'ถอนความยินยอม'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-gray-500">
                          {new Date(record.grantedAt).toLocaleDateString('th-TH')}
                        </td>
                        <td className="py-2.5 text-xs text-gray-500">
                          {record.expiresAt ? new Date(record.expiresAt).toLocaleDateString('th-TH') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {activeTab === 'audit' && (
        <Card>
          <Body size="small" className="mb-3 font-medium text-[#1d1d1f]">บันทึกการตรวจสอบ</Body>
          {loadingAudit ? (
            <Body size="caption" className="py-8 text-center text-gray-400">กำลังโหลด...</Body>
          ) : auditLogs.length === 0 ? (
            <Body size="caption" className="py-8 text-center text-gray-400">ยังไม่มีบันทึกการตรวจสอบ</Body>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-2 pr-4 text-xs font-medium text-gray-500">เวลา</th>
                    <th className="pb-2 pr-4 text-xs font-medium text-gray-500">ผู้ใช้</th>
                    <th className="pb-2 pr-4 text-xs font-medium text-gray-500">ข้อมูล</th>
                    <th className="pb-2 pr-4 text-xs font-medium text-gray-500">การดำเนินการ</th>
                    <th className="pb-2 pr-4 text-xs font-medium text-gray-500">ค่าเดิม</th>
                    <th className="pb-2 text-xs font-medium text-gray-500">ค่าใหม่</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id} className="border-b border-gray-100">
                      <td className="py-2.5 pr-4 text-xs text-gray-500">
                        {new Date(log.createdAt).toLocaleString('th-TH')}
                      </td>
                      <td className="py-2.5 pr-4 text-sm text-[#1d1d1f]">{log.userName}</td>
                      <td className="py-2.5 pr-4">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                          {log.entityType}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          log.action === 'create' ? 'bg-green-100 text-green-700' :
                          log.action === 'update' ? 'bg-blue-100 text-blue-700' :
                          log.action === 'delete' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {log.action === 'create' ? 'สร้าง' :
                           log.action === 'update' ? 'แก้ไข' :
                           log.action === 'delete' ? 'ลบ' : log.action}
                        </span>
                      </td>
                      <td className="max-w-[150px] truncate py-2.5 pr-4 font-mono text-[10px] text-gray-400">
                        {log.oldValues ? JSON.stringify(log.oldValues) : '-'}
                      </td>
                      <td className="max-w-[150px] truncate py-2.5 font-mono text-[10px] text-gray-400">
                        {log.newValues ? JSON.stringify(log.newValues) : '-'}
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
