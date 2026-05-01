/**
 * Lead Scoring & Qualification Tools
 * Feature #1: Smart Lead Qualification & Scoring
 * Feature #8: Auto-tagging & Categorization
 */
import { tool } from '@strands-agents/sdk';
import { z } from 'zod';

const SALES_API = process.env.SALES_API_URL || 'http://localhost:3003';
const CRM_API = process.env.CRM_API_URL || 'http://localhost:3002';

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

export const updateLeadScore = tool({
  name: 'update_lead_score',
  description: 'อัปเดตคะแนน AI Score ของ Lead (0-100) พร้อมเหตุผล เขียนลง DB จริง',
  inputSchema: z.object({
    tenantId: z.string(),
    leadId: z.string(),
    score: z.number().min(0).max(100).describe('คะแนน 0-100: 0-30=Cold, 31-60=Warm, 61-80=Hot, 81-100=Very Hot'),
    reason: z.string().describe('เหตุผลที่ให้คะแนนนี้'),
    factors: z.object({
      budget: z.number().min(0).max(25).optional().describe('คะแนนจากงบประมาณ (0-25)'),
      urgency: z.number().min(0).max(25).optional().describe('คะแนนจากความเร่งด่วน (0-25)'),
      authority: z.number().min(0).max(25).optional().describe('คะแนนจากอำนาจตัดสินใจ (0-25)'),
      fit: z.number().min(0).max(25).optional().describe('คะแนนจากความเหมาะสมกับสินค้า (0-25)'),
    }).optional(),
  }),
  callback: async (input) => {
    const data = await apiCall(SALES_API, `/leads/${input.leadId}`, {
      method: 'PATCH',
      headers: { 'x-tenant-id': input.tenantId } as any,
      body: JSON.stringify({
        aiScore: input.score,
        metadata: {
          aiScore: input.score,
          aiReason: input.reason,
          aiFactors: input.factors,
          aiScoredAt: new Date().toISOString(),
        },
      }),
    });
    return `Lead score updated to ${input.score}/100. Reason: ${input.reason}`;
  },
});

export const updateAccountTier = tool({
  name: 'update_account_tier',
  description: 'อัปเดต Account Tier (standard/silver/gold/platinum) ตามยอดซื้อและ engagement',
  inputSchema: z.object({
    tenantId: z.string(),
    accountId: z.string(),
    tier: z.string().describe('standard, silver, gold, platinum'),
    reason: z.string().describe('เหตุผลที่แนะนำ tier นี้'),
  }),
  callback: async (input) => {
    const data = await apiCall(CRM_API, `/accounts/${input.accountId}`, {
      method: 'PATCH',
      headers: { 'x-tenant-id': input.tenantId } as any,
      body: JSON.stringify({
        accountTier: input.tier,
        customFields: { tierReason: input.reason, tierUpdatedAt: new Date().toISOString() },
      }),
    });
    return `Account tier updated to ${input.tier}. Reason: ${input.reason}`;
  },
});

export const addAccountTag = tool({
  name: 'add_account_tag',
  description: 'เพิ่ม tag ให้ Account เช่น industry, size, interest, urgency',
  inputSchema: z.object({
    tenantId: z.string(),
    accountId: z.string(),
    tagName: z.string().describe('ชื่อ tag เช่น "retail", "hot-lead", "ERP-interest"'),
    color: z.string().optional().default('#0176D3'),
  }),
  callback: async (input) => {
    const data = await apiCall(CRM_API, `/accounts/${input.accountId}/tags`, {
      method: 'POST',
      headers: { 'x-tenant-id': input.tenantId } as any,
      body: JSON.stringify({ name: input.tagName, color: input.color }),
    });
    return `Tag "${input.tagName}" added to account.`;
  },
});

export const getLeadConversationHistory = tool({
  name: 'get_lead_conversation_history',
  description: 'ดึงประวัติ conversation ของ Lead จาก LINE เพื่อวิเคราะห์และให้คะแนน',
  inputSchema: z.object({
    tenantId: z.string(),
    leadId: z.string(),
  }),
  callback: async (input) => {
    const data = await apiCall(SALES_API, `/leads/${input.leadId}/conversations`, {
      headers: { 'x-tenant-id': input.tenantId } as any,
    });
    return JSON.stringify(data);
  },
});

export const getSalesRepWorkload = tool({
  name: 'get_sales_rep_workload',
  description: 'ดึงข้อมูล workload ของ Sales Rep แต่ละคน เพื่อแนะนำว่าควร assign Lead ให้ใคร',
  inputSchema: z.object({
    tenantId: z.string(),
  }),
  callback: async (input) => {
    const data = await apiCall(SALES_API, '/reps/workload', {
      headers: { 'x-tenant-id': input.tenantId } as any,
    });
    return JSON.stringify(data);
  },
});
