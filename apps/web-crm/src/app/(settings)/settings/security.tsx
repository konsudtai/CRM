'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Heading, Body, Button } from '@thai-smb-crm/ui-components';
import { api } from '@/lib/api';

interface IpEntry {
  id: string;
  address: string;
  createdAt: string;
}

interface UserMfaStatus {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  mfaEnabled: boolean;
}

interface TenantSecuritySettings {
  mfaRequired: boolean;
  ipAllowlist: IpEntry[];
}

export default function SecuritySettings() {
  const queryClient = useQueryClient();
  const [newIp, setNewIp] = useState('');

  const { data: securitySettings } = useQuery<TenantSecuritySettings>({
    queryKey: ['security-settings'],
    queryFn: () => api('/settings/security'),
    placeholderData: { mfaRequired: false, ipAllowlist: [] },
  });

  const { data: users = [] } = useQuery<UserMfaStatus[]>({
    queryKey: ['users-mfa'],
    queryFn: () => api('/users', { params: { fields: 'id,email,firstName,lastName,mfaEnabled' } }),
    placeholderData: [],
  });

  const toggleMfaMutation = useMutation({
    mutationFn: (required: boolean) =>
      api('/settings/security/mfa', { method: 'PUT', body: JSON.stringify({ mfaRequired: required }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['security-settings'] }),
  });

  const addIpMutation = useMutation({
    mutationFn: (address: string) =>
      api('/settings/security/ip-allowlist', { method: 'POST', body: JSON.stringify({ address }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-settings'] });
      setNewIp('');
    },
  });

  const removeIpMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/settings/security/ip-allowlist/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['security-settings'] }),
  });

  const ipAllowlist = securitySettings?.ipAllowlist ?? [];
  const mfaRequired = securitySettings?.mfaRequired ?? false;

  return (
    <div>
      <div className="mb-6">
        <Heading as="h2" size="title">ความปลอดภัย</Heading>
        <Body size="small" className="mt-1 text-gray-500">จัดการการตั้งค่าความปลอดภัย</Body>
      </div>

      {/* IP Allowlist */}
      <Card className="mb-4">
        <div className="mb-4">
          <Heading as="h3" size="subtitle">IP Allowlist</Heading>
          <Body size="caption" className="mt-1 text-gray-500">จำกัดการเข้าถึงจาก IP ที่อนุญาตเท่านั้น</Body>
        </div>

        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={newIp}
            onChange={e => setNewIp(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0071e3] focus:outline-none focus:ring-1 focus:ring-[#0071e3]"
            placeholder="เช่น 192.168.1.0/24"
            onKeyDown={e => {
              if (e.key === 'Enter' && newIp.trim()) addIpMutation.mutate(newIp.trim());
            }}
          />
          <Button
            variant="primary"
            onClick={() => newIp.trim() && addIpMutation.mutate(newIp.trim())}
            disabled={!newIp.trim() || addIpMutation.isPending}
          >
            เพิ่ม
          </Button>
        </div>

        {ipAllowlist.length === 0 ? (
          <Body size="caption" className="text-gray-400">ยังไม่มี IP ที่อนุญาต — ทุก IP สามารถเข้าถึงได้</Body>
        ) : (
          <div className="space-y-2">
            {ipAllowlist.map(ip => (
              <div key={ip.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-[#1d1d1f]">{ip.address}</span>
                  <Body size="caption" className="text-gray-400">
                    เพิ่มเมื่อ {new Date(ip.createdAt).toLocaleDateString('th-TH')}
                  </Body>
                </div>
                <button
                  onClick={() => removeIpMutation.mutate(ip.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                  disabled={removeIpMutation.isPending}
                >
                  ลบออก
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* MFA Settings */}
      <Card>
        <div className="mb-4">
          <Heading as="h3" size="subtitle">การยืนยันตัวตนสองขั้นตอน (MFA)</Heading>
          <Body size="caption" className="mt-1 text-gray-500">กำหนดให้ผู้ใช้ทุกคนต้องเปิดใช้ MFA</Body>
        </div>

        <div className="mb-6 flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
          <div>
            <span className="text-sm font-medium text-[#1d1d1f]">บังคับใช้ MFA สำหรับทุกผู้ใช้</span>
            <Body size="caption" className="text-gray-500">
              เมื่อเปิดใช้ ผู้ใช้ทุกคนจะต้องตั้งค่า MFA ก่อนเข้าใช้งาน
            </Body>
          </div>
          <button
            onClick={() => toggleMfaMutation.mutate(!mfaRequired)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
              mfaRequired ? 'bg-[#0071e3]' : 'bg-gray-300'
            }`}
            role="switch"
            aria-checked={mfaRequired}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                mfaRequired ? 'translate-x-5' : 'translate-x-0.5'
              } mt-0.5`}
            />
          </button>
        </div>

        <div>
          <Body size="small" className="mb-3 font-medium text-[#1d1d1f]">สถานะ MFA ของผู้ใช้</Body>
          {users.length === 0 ? (
            <Body size="caption" className="text-gray-400">ไม่พบข้อมูลผู้ใช้</Body>
          ) : (
            <div className="space-y-2">
              {users.map(user => (
                <div key={user.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <div>
                    <span className="text-sm text-[#1d1d1f]">{user.firstName} {user.lastName}</span>
                    <Body size="caption" className="text-gray-400">{user.email}</Body>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    user.mfaEnabled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {user.mfaEnabled ? 'เปิดใช้ MFA' : 'ยังไม่เปิด MFA'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
