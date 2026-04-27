'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Heading, Body, Button } from '@thai-smb-crm/ui-components';
import type { WebhookConfig, WebhookDelivery } from '@thai-smb-crm/shared-types';
import { api } from '@/lib/api';

const EVENT_TYPES = [
  'lead.created', 'lead.updated', 'lead.deleted',
  'opportunity.created', 'opportunity.updated', 'opportunity.stage_changed',
  'account.created', 'account.updated',
  'contact.created', 'contact.updated',
  'quotation.created', 'quotation.sent', 'quotation.accepted',
  'task.created', 'task.completed',
];

const ENTITY_TYPES = ['lead', 'opportunity', 'account', 'contact', 'quotation', 'task'];

export default function WebhooksSettings() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [viewingLogs, setViewingLogs] = useState<string | null>(null);

  // Form state
  const [formUrl, setFormUrl] = useState('');
  const [formSecret, setFormSecret] = useState('');
  const [formEventTypes, setFormEventTypes] = useState<string[]>([]);
  const [formEntityTypes, setFormEntityTypes] = useState<string[]>([]);
  const [formActive, setFormActive] = useState(true);

  const { data: webhooks = [], isLoading } = useQuery<WebhookConfig[]>({
    queryKey: ['webhooks'],
    queryFn: () => api('/webhooks'),
    placeholderData: [],
  });

  const { data: deliveryLogs = [] } = useQuery<WebhookDelivery[]>({
    queryKey: ['webhook-logs', viewingLogs],
    queryFn: () => api(`/webhooks/${viewingLogs}/logs`),
    enabled: !!viewingLogs,
    placeholderData: [],
  });

  const saveMutation = useMutation({
    mutationFn: (data: Partial<WebhookConfig>) =>
      editingWebhook
        ? api(`/webhooks/${editingWebhook.id}`, { method: 'PUT', body: JSON.stringify(data) })
        : api('/webhooks', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      resetForm();
    },
  });

  function resetForm() {
    setShowForm(false);
    setEditingWebhook(null);
    setFormUrl('');
    setFormSecret('');
    setFormEventTypes([]);
    setFormEntityTypes([]);
    setFormActive(true);
  }

  function openEdit(wh: WebhookConfig) {
    setEditingWebhook(wh);
    setFormUrl(wh.url);
    setFormSecret(wh.secret);
    setFormEventTypes(wh.eventTypes);
    setFormEntityTypes(wh.entityTypes);
    setFormActive(wh.isActive);
    setShowForm(true);
  }

  function toggleItem(list: string[], item: string, setter: (v: string[]) => void) {
    setter(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  }

  function handleSave() {
    saveMutation.mutate({
      url: formUrl,
      secret: formSecret,
      eventTypes: formEventTypes,
      entityTypes: formEntityTypes,
      isActive: formActive,
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Heading as="h2" size="title">Webhooks</Heading>
          <Body size="small" className="mt-1 text-gray-500">จัดการ Webhook endpoints และดูบันทึกการส่ง</Body>
        </div>
        {!showForm && (
          <Button variant="primary" onClick={() => { resetForm(); setShowForm(true); }}>
            + สร้าง Webhook
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="mb-6">
          <Heading as="h3" size="subtitle" className="mb-4">
            {editingWebhook ? 'แก้ไข Webhook' : 'สร้าง Webhook'}
          </Heading>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#1d1d1f]">URL</label>
              <input
                type="url"
                value={formUrl}
                onChange={e => setFormUrl(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0071e3] focus:outline-none focus:ring-1 focus:ring-[#0071e3]"
                placeholder="https://example.com/webhook"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#1d1d1f]">HMAC Secret</label>
              <input
                type="password"
                value={formSecret}
                onChange={e => setFormSecret(e.target.value)}
                className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0071e3] focus:outline-none focus:ring-1 focus:ring-[#0071e3]"
                placeholder="กรอก HMAC Secret"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#1d1d1f]">ประเภทเหตุการณ์</label>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map(et => (
                  <button
                    key={et}
                    onClick={() => toggleItem(formEventTypes, et, setFormEventTypes)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      formEventTypes.includes(et)
                        ? 'bg-[#0071e3] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {et}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#1d1d1f]">ประเภทข้อมูล</label>
              <div className="flex flex-wrap gap-2">
                {ENTITY_TYPES.map(et => (
                  <button
                    key={et}
                    onClick={() => toggleItem(formEntityTypes, et, setFormEntityTypes)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      formEntityTypes.includes(et)
                        ? 'bg-[#0071e3] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {et}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="webhook-active"
                checked={formActive}
                onChange={e => setFormActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#0071e3] focus:ring-[#0071e3]"
              />
              <label htmlFor="webhook-active" className="text-sm text-[#1d1d1f]">เปิดใช้งาน</label>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={handleSave} disabled={!formUrl || saveMutation.isPending}>
              {saveMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
            <Button variant="secondary" onClick={resetForm}>ยกเลิก</Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Body size="small" className="py-12 text-center text-gray-400">กำลังโหลด...</Body>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => (
            <Card key={wh.id} className="!py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${wh.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <span className="text-sm font-medium text-[#1d1d1f]">{wh.url}</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {wh.eventTypes.slice(0, 3).map(et => (
                        <span key={et} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">{et}</span>
                      ))}
                      {wh.eventTypes.length > 3 && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                          +{wh.eventTypes.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setViewingLogs(viewingLogs === wh.id ? null : wh.id)}>
                    บันทึกการส่ง
                  </Button>
                  <Button variant="ghost" onClick={() => openEdit(wh)}>แก้ไข</Button>
                </div>
              </div>

              {viewingLogs === wh.id && (
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <Body size="small" className="mb-2 font-medium text-[#1d1d1f]">บันทึกการส่ง</Body>
                  {deliveryLogs.length === 0 ? (
                    <Body size="caption" className="text-gray-400">ยังไม่มีบันทึกการส่ง</Body>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="pb-2 text-xs font-medium text-gray-500">เวลา</th>
                            <th className="pb-2 text-xs font-medium text-gray-500">เหตุการณ์</th>
                            <th className="pb-2 text-xs font-medium text-gray-500">สถานะ</th>
                            <th className="pb-2 text-xs font-medium text-gray-500">HTTP Status</th>
                            <th className="pb-2 text-xs font-medium text-gray-500">จำนวนครั้ง</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deliveryLogs.map(log => (
                            <tr key={log.id} className="border-b border-gray-100">
                              <td className="py-2 text-xs text-gray-600">
                                {new Date(log.createdAt).toLocaleString('th-TH')}
                              </td>
                              <td className="py-2 text-xs">{log.eventType}</td>
                              <td className="py-2">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  log.status === 'success' ? 'bg-green-100 text-green-700' :
                                  log.status === 'failed' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {log.status === 'success' ? 'สำเร็จ' : log.status === 'failed' ? 'ล้มเหลว' : 'รอดำเนินการ'}
                                </span>
                              </td>
                              <td className="py-2 text-xs text-gray-600">{log.responseStatus ?? '-'}</td>
                              <td className="py-2 text-xs text-gray-600">{log.attempts}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
          {webhooks.length === 0 && !showForm && (
            <Body size="small" className="py-12 text-center text-gray-400">ยังไม่มี Webhook</Body>
          )}
        </div>
      )}
    </div>
  );
}
