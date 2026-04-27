'use client';

import { useState } from 'react';
import { Heading, Body } from '@thai-smb-crm/ui-components';
import RolesSettings from './roles';
import IntegrationsSettings from './integrations';
import WebhooksSettings from './webhooks';
import SecuritySettings from './security';
import PdpaSettings from './pdpa';

type SettingsTab = 'roles' | 'integrations' | 'webhooks' | 'security' | 'pdpa';

const TABS: { key: SettingsTab; label: string; icon: string }[] = [
  { key: 'roles', label: 'บทบาทและสิทธิ์', icon: '👥' },
  { key: 'integrations', label: 'การเชื่อมต่อ', icon: '🔗' },
  { key: 'webhooks', label: 'Webhooks', icon: '🔔' },
  { key: 'security', label: 'ความปลอดภัย', icon: '🔒' },
  { key: 'pdpa', label: 'PDPA', icon: '📋' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('roles');

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* Header — white bar */}
      <div className="border-b border-black/[0.06] bg-white px-6 py-6 md:px-8 lg:px-12">
        <Heading as="h1" size="section">ตั้งค่า</Heading>
        <Body size="small" className="mt-1 !text-[rgba(0,0,0,0.48)]">
          จัดการการตั้งค่าระบบ
        </Body>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-black/[0.06] bg-white">
          <nav className="flex flex-col gap-0.5 p-3">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-left font-sf-pro-text text-[14px] font-medium tracking-[-0.224px] transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[#0071e3]/10 text-[#0071e3]'
                    : 'text-[#1d1d1f] hover:bg-black/[0.04]'
                }`}
              >
                <span className="text-base">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-6 md:p-8 lg:p-12">
          {activeTab === 'roles' && <RolesSettings />}
          {activeTab === 'integrations' && <IntegrationsSettings />}
          {activeTab === 'webhooks' && <WebhooksSettings />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'pdpa' && <PdpaSettings />}
        </main>
      </div>
    </div>
  );
}
