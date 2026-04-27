'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Heading, Body, Button } from '@thai-smb-crm/ui-components';
import { api } from '@/lib/api';

export default function NewTaskPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [accountId, setAccountId] = useState('');
  const [contactId, setContactId] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: description || undefined,
          dueDate,
          priority,
          accountId: accountId || undefined,
          contactId: contactId || undefined,
          opportunityId: opportunityId || undefined,
        }),
      });
      router.push('/tasks');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = 'w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#0071e3] focus:outline-none focus:ring-1 focus:ring-[#0071e3]';

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <a href="/tasks" className="text-sm text-[#0066cc] hover:underline">← กลับไปรายการงาน</a>
        </div>
        <Heading as="h1" size="headline">สร้างงานใหม่</Heading>
        <Body size="small" className="mb-6 mt-1 text-gray-500">กรอกรายละเอียดงานที่ต้องการสร้าง</Body>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <Card>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">ชื่องาน *</label>
              <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
                className={inputClass} placeholder="เช่น ติดตามลูกค้า ABC" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">รายละเอียด</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                className={inputClass} placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">วันครบกำหนด *</label>
                <input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">ความสำคัญ *</label>
                <select value={priority} onChange={e => setPriority(e.target.value as 'High' | 'Medium' | 'Low')}
                  className={inputClass}>
                  <option value="High">สูง</option>
                  <option value="Medium">กลาง</option>
                  <option value="Low">ต่ำ</option>
                </select>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-5">
              <Body size="small" className="mb-3 font-medium text-gray-700">เชื่อมโยงกับ (ไม่บังคับ)</Body>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">บัญชีลูกค้า</label>
                  <input type="text" value={accountId} onChange={e => setAccountId(e.target.value)}
                    className={inputClass} placeholder="Account ID" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">ผู้ติดต่อ</label>
                  <input type="text" value={contactId} onChange={e => setContactId(e.target.value)}
                    className={inputClass} placeholder="Contact ID" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">โอกาสการขาย</label>
                  <input type="text" value={opportunityId} onChange={e => setOpportunityId(e.target.value)}
                    className={inputClass} placeholder="Opportunity ID" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <a href="/tasks"><Button variant="secondary" type="button">ยกเลิก</Button></a>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? 'กำลังบันทึก...' : 'สร้างงาน'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
