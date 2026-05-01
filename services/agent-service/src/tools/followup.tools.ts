/**
 * Smart Follow-up & Meeting Tools
 * Feature #3: Smart Follow-up Scheduling
 * Feature #6: Meeting Prep & Post-meeting Actions
 */
import { tool } from '@strands-agents/sdk';
import { z } from 'zod';

const CRM_API = process.env.CRM_API_URL || 'http://localhost:3002';
const SALES_API = process.env.SALES_API_URL || 'http://localhost:3003';

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

export const createFollowUpTask = tool({
  name: 'create_follow_up_task',
  description: 'สร้าง follow-up Task อัตโนมัติ พร้อมกำหนดวัน priority และเหตุผล',
  inputSchema: z.object({
    tenantId: z.string(),
    title: z.string(),
    description: z.string().optional(),
    assignedTo: z.string(),
    dueDate: z.string().describe('YYYY-MM-DD'),
    priority: z.string().default('Medium'),
    relatedAccountId: z.string().optional(),
    relatedLeadId: z.string().optional(),
    relatedOpportunityId: z.string().optional(),
    triggerReason: z.string().describe('เหตุผลที่สร้าง: post_assign, post_qt_sent, post_meeting, stale_deal, follow_up'),
  }),
  callback: async (input) => {
    const data = await apiCall(CRM_API, '/tasks', {
      method: 'POST',
      headers: { 'x-tenant-id': input.tenantId } as any,
      body: JSON.stringify({
        title: input.title,
        description: `${input.description || ''}\n\n[สร้างอัตโนมัติโดย น้องขายไว — ${input.triggerReason}]`,
        assignedTo: input.assignedTo,
        dueDate: input.dueDate,
        priority: input.priority,
        accountId: input.relatedAccountId,
        opportunityId: input.relatedOpportunityId,
      }),
    });
    return JSON.stringify(data);
  },
});

export const getOverdueTasks = tool({
  name: 'get_overdue_tasks',
  description: 'ดึง Task ที่เกินกำหนดทั้งหมด หรือเฉพาะของ user',
  inputSchema: z.object({
    tenantId: z.string(),
    userId: z.string().optional().describe('ถ้าไม่ระบุ จะดึงทั้ง tenant'),
  }),
  callback: async (input) => {
    const params = new URLSearchParams({ overdue: 'true' });
    if (input.userId) params.set('assignedTo', input.userId);
    const data = await apiCall(CRM_API, `/tasks?${params}`, {
      headers: { 'x-tenant-id': input.tenantId } as any,
    });
    return JSON.stringify(data);
  },
});

export const getUpcomingTasks = tool({
  name: 'get_upcoming_tasks',
  description: 'ดึง Task ที่ครบกำหนดภายใน N วัน',
  inputSchema: z.object({
    tenantId: z.string(),
    userId: z.string().optional(),
    daysAhead: z.number().optional().default(1),
  }),
  callback: async (input) => {
    const params = new URLSearchParams({ daysAhead: String(input.daysAhead) });
    if (input.userId) params.set('assignedTo', input.userId);
    const data = await apiCall(CRM_API, `/tasks/upcoming?${params}`, {
      headers: { 'x-tenant-id': input.tenantId } as any,
    });
    return JSON.stringify(data);
  },
});

export const completeTask = tool({
  name: 'complete_task',
  description: 'Mark Task เป็น Completed',
  inputSchema: z.object({
    tenantId: z.string(),
    taskId: z.string(),
  }),
  callback: async (input) => {
    const data = await apiCall(CRM_API, `/tasks/${input.taskId}`, {
      method: 'PATCH',
      headers: { 'x-tenant-id': input.tenantId } as any,
      body: JSON.stringify({ status: 'Completed', completedAt: new Date().toISOString() }),
    });
    return `Task ${input.taskId} marked as completed.`;
  },
});

export const getMeetingContext = tool({
  name: 'get_meeting_context',
  description: 'ดึงข้อมูลทั้งหมดของ Account เพื่อเตรียม meeting: company info, contacts, deals, activities, QTs, notes',
  inputSchema: z.object({
    tenantId: z.string(),
    accountId: z.string(),
  }),
  callback: async (input) => {
    const [account, activities, opportunities, quotations] = await Promise.all([
      apiCall(CRM_API, `/accounts/${input.accountId}`, { headers: { 'x-tenant-id': input.tenantId } as any }),
      apiCall(CRM_API, `/accounts/${input.accountId}/activities?limit=10`, { headers: { 'x-tenant-id': input.tenantId } as any }).catch(() => []),
      apiCall(SALES_API, `/opportunities?accountId=${input.accountId}`, { headers: { 'x-tenant-id': input.tenantId } as any }).catch(() => []),
      apiCall(SALES_API, `/quotations?accountId=${input.accountId}`, { headers: { 'x-tenant-id': input.tenantId } as any }).catch(() => []),
    ]);
    return JSON.stringify({ account, activities, opportunities, quotations });
  },
});

export const getPipelineStages = tool({
  name: 'get_pipeline_stages',
  description: 'ดึงรายชื่อ Pipeline Stages ทั้งหมดของ tenant พร้อม ID, probability, sort order',
  inputSchema: z.object({
    tenantId: z.string(),
  }),
  callback: async (input) => {
    const data = await apiCall(SALES_API, '/pipeline/stages', {
      headers: { 'x-tenant-id': input.tenantId } as any,
    });
    return JSON.stringify(data);
  },
});

export const getUsers = tool({
  name: 'get_users',
  description: 'ดึงรายชื่อ Users ทั้งหมดของ tenant พร้อม role, เพื่อหาว่าใครเป็น Sales Rep, Manager',
  inputSchema: z.object({
    tenantId: z.string(),
  }),
  callback: async (input) => {
    const AUTH_API = process.env.AUTH_API_URL || 'http://localhost:3001';
    const data = await apiCall(AUTH_API, '/users', {
      headers: { 'x-tenant-id': input.tenantId } as any,
    });
    return JSON.stringify(data);
  },
});
