'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, Heading, Body, Button } from '@thai-smb-crm/ui-components';
import { api } from '@/lib/api';

interface IntegrationStatus {
  connected: boolean;
  lastSync?: string;
}

export default function IntegrationsSettings() {
  // LINE OA state
  const [lineToken, setLineToken] = useState('');
  const [lineSecret, setLineSecret] = useState('');

  // Integration connection statuses (would come from API in production)
  const [integrations, setIntegrations] = useState<Record<string, IntegrationStatus>>({
    gmail: { connected: false },
    outlook: { connected: false },
    googleCalendar: { connected: false },
    microsoftCalendar: { connected: false },
  });

  const saveLineMutation = useMutation({
    mutationFn: () =>
      api('/line/configure', {
        method: 'POST',
        body: JSON.stringify({ channelAccessToken: lineToken, channelSecret: lineSecret }),
      }),
  });

  function handleConnect(service: string) {
    setIntegrations(prev => ({
      ...prev,
      [service]: { connected: true, lastSync: new Date().toISOString() },
    }));
  }

  function handleDisconnect(service: string) {
    setIntegrations(prev => ({
      ...prev,
      [service]: { connected: false },
    }));
  }

  return (
    <div>
      <div className="mb-6">
        <Heading as="h2" size="title">การเชื่อมต่อ</Heading>
        <Body size="small" className="mt-1 text-gray-500">จัดการการเชื่อมต่อกับบริการภายนอก</Body>
      </div>

      {/* LINE OA */}
      <Card className="mb-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-lg">💬</div>
          <div>
            <span className="text-sm font-semibold text-[#1d1d1f]">LINE Official Account</span>
            <Body size="caption" className="text-gray-500">เชื่อมต่อ LINE OA เพื่อส่งข้อความและรับแจ้งเตือน</Body>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Channel Access Token</label>
            <input
              type="password"
              value={lineToken}
              onChange={e => setLineToken(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0071e3] focus:outline-none focus:ring-1 focus:ring-[#0071e3]"
              placeholder="กรอก Channel Access Token"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Channel Secret</label>
            <input
              type="password"
              value={lineSecret}
              onChange={e => setLineSecret(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0071e3] focus:outline-none focus:ring-1 focus:ring-[#0071e3]"
              placeholder="กรอก Channel Secret"
            />
          </div>
          <Button
            variant="primary"
            onClick={() => saveLineMutation.mutate()}
            disabled={!lineToken || !lineSecret || saveLineMutation.isPending}
          >
            {saveLineMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
          {saveLineMutation.isSuccess && (
            <Body size="caption" className="text-green-600">บันทึกสำเร็จ</Body>
          )}
        </div>
      </Card>

      {/* Email Integrations */}
      <Heading as="h3" size="subtitle" className="mb-3 mt-6">อีเมล</Heading>
      <div className="space-y-3">
        <IntegrationCard
          icon="📧"
          iconBg="bg-red-100"
          title="Gmail"
          description="ซิงค์อีเมลจาก Gmail"
          status={integrations.gmail}
          onConnect={() => handleConnect('gmail')}
          onDisconnect={() => handleDisconnect('gmail')}
        />
        <IntegrationCard
          icon="📬"
          iconBg="bg-blue-100"
          title="Outlook"
          description="ซิงค์อีเมลจาก Outlook"
          status={integrations.outlook}
          onConnect={() => handleConnect('outlook')}
          onDisconnect={() => handleDisconnect('outlook')}
        />
      </div>

      {/* Calendar Integrations */}
      <Heading as="h3" size="subtitle" className="mb-3 mt-6">ปฏิทิน</Heading>
      <div className="space-y-3">
        <IntegrationCard
          icon="📅"
          iconBg="bg-blue-100"
          title="Google Calendar"
          description="ซิงค์ปฏิทินจาก Google Calendar"
          status={integrations.googleCalendar}
          onConnect={() => handleConnect('googleCalendar')}
          onDisconnect={() => handleDisconnect('googleCalendar')}
          syncInterval="ทุก 5 นาที"
        />
        <IntegrationCard
          icon="📆"
          iconBg="bg-indigo-100"
          title="Microsoft 365 Calendar"
          description="ซิงค์ปฏิทินจาก Microsoft 365"
          status={integrations.microsoftCalendar}
          onConnect={() => handleConnect('microsoftCalendar')}
          onDisconnect={() => handleDisconnect('microsoftCalendar')}
          syncInterval="ทุก 5 นาที"
        />
      </div>
    </div>
  );
}

function IntegrationCard({
  icon,
  iconBg,
  title,
  description,
  status,
  onConnect,
  onDisconnect,
  syncInterval,
}: {
  icon: string;
  iconBg: string;
  title: string;
  description: string;
  status: IntegrationStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  syncInterval?: string;
}) {
  return (
    <Card className="flex items-center justify-between !py-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg ${iconBg}`}>{icon}</div>
        <div>
          <span className="text-sm font-semibold text-[#1d1d1f]">{title}</span>
          <Body size="caption" className="text-gray-500">{description}</Body>
          {status.connected && (
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
              <Body size="caption" className="text-green-600">เชื่อมต่อแล้ว</Body>
              {syncInterval && (
                <Body size="caption" className="text-gray-400">· ช่วงเวลาซิงค์: {syncInterval}</Body>
              )}
            </div>
          )}
        </div>
      </div>
      {status.connected ? (
        <Button variant="secondary" onClick={onDisconnect}>ยกเลิกการเชื่อมต่อ</Button>
      ) : (
        <Button variant="primary" onClick={onConnect}>เชื่อมต่อ</Button>
      )}
    </Card>
  );
}
