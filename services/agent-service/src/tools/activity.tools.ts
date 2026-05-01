/**
 * Activity & Note Tools — Auto-log everything น้องขายไว does into the DB.
 * Feature #2: Auto-create Activity Log
 * Feature #4: Conversation Summary & Handoff Notes
 */
import { tool } from '@strands-agents/sdk';
import { z } from 'zod';

const CRM_API = process.env.CRM_API_URL || 'http://localhost:3002';
const NOTIFICATION_API = process.env.NOTIFICATION_API_URL || 'http://localhost:3005';

async function apiCall(baseUrl: string, path: string, options: RequestInit = {}) {
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

export const logActivity = tool({
  name: 'log_activity',
  description: 'บันทึก Activity ลง Timeline ของ Account/Lead/Opportunity ทุกครั้งที่ทำ action สำคัญ',
  inputSchema: z.object({
    tenantId: z.string(),
    entityType: z.string().describe('account, contact, lead, opportunity'),
    entityId: z.string(),
    summary: z.string().describe('สรุปสิ่งที่ทำ เช่น "น้องขายไว assign Lead → อรุณ"'),
    userId: z.string().optional().describe('User ID ที่เกี่ยวข้อง (ถ้ามี)'),
    metadata: z.record(z.any()).optional(),
  }),
  callback: async (input) => {
    const data = await apiCall(CRM_API, '/activities', {
      method: 'POST',
      headers: { 'x-tenant-id': input.tenantId } as any,
      body: JSON.stringify({
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        userId: input.userId || 'system-agent',
        metadata: { ...input.metadata, source: 'น้องขายไว', automated: true },
      }),
    });
    return JSON.stringify(data);
  },
});

export const createNote = tool({
  name: 'create_note',
  description: 'สร้าง Note ใน Account/Lead เช่น สรุป conversation จาก LINE, meeting notes, handoff notes',
  inputSchema: z.object({
    tenantId: z.string(),
    entityType: z.string().describe('account, contact, lead'),
    entityId: z.string(),
    content: z.string().describe('เนื้อหา Note — สรุป conversation, meeting prep, handoff notes'),
    authorId: z.string().optional(),
  }),
  callback: async (input) => {
    const data = await apiCall(CRM_API, '/notes', {
      method: 'POST',
      headers: { 'x-tenant-id': input.tenantId } as any,
      body: JSON.stringify({
        entityType: input.entityType,
        entityId: input.entityId,
        content: input.content,
        authorId: input.authorId || 'system-agent',
      }),
    });
    return JSON.stringify(data);
  },
});

export const sendNotification = tool({
  name: 'send_notification',
  description: 'ส่ง notification ให้ user ผ่าน in-app, LINE, หรือ email',
  inputSchema: z.object({
    tenantId: z.string(),
    userId: z.string().describe('User ID ที่จะส่งให้'),
    channel: z.string().default('in_app').describe('in_app, line, email'),
    type: z.string().describe('ประเภท: lead_assigned, qt_pending, task_reminder, daily_digest, deal_update'),
    title: z.string(),
    body: z.string(),
    metadata: z.record(z.any()).optional(),
  }),
  callback: async (input) => {
    const data = await apiCall(NOTIFICATION_API, '/notifications', {
      method: 'POST',
      headers: { 'x-tenant-id': input.tenantId } as any,
      body: JSON.stringify({
        userId: input.userId,
        channel: input.channel,
        type: input.type,
        title: input.title,
        body: input.body,
        metadata: { ...input.metadata, source: 'น้องขายไว' },
      }),
    });
    return JSON.stringify(data);
  },
});

export const sendLineMessage = tool({
  name: 'send_line_message',
  description: 'ส่งข้อความ LINE ให้ลูกค้าหรือ Sales Rep ผ่าน LINE OA',
  inputSchema: z.object({
    tenantId: z.string(),
    lineUserId: z.string().optional().describe('LINE User ID ของผู้รับ'),
    userId: z.string().optional().describe('CRM User ID (จะหา LINE ID จาก DB)'),
    message: z.string(),
  }),
  callback: async (input) => {
    const data = await apiCall(NOTIFICATION_API, '/line/send', {
      method: 'POST',
      headers: { 'x-tenant-id': input.tenantId } as any,
      body: JSON.stringify({
        lineUserId: input.lineUserId,
        userId: input.userId,
        message: input.message,
      }),
    });
    return JSON.stringify(data);
  },
});
