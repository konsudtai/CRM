/**
 * Deal Health & Opportunity Intelligence Tools
 * Feature #5: Deal Health Monitoring
 * Feature #10: Win/Loss Analysis & Coaching
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

export const updateDealHealthScore = tool({
  name: 'update_deal_health_score',
  description: 'อัปเดต health score ของ Deal/Opportunity เขียนลง DB',
  inputSchema: z.object({
    tenantId: z.string(),
    opportunityId: z.string(),
    healthScore: z.string().describe('green, yellow, red'),
    reason: z.string(),
    recommendation: z.string().describe('แนะนำ action ที่ควรทำ'),
  }),
  callback: async (input) => {
    const data = await apiCall(SALES_API, `/opportunities/${input.opportunityId}`, {
      method: 'PATCH',
      headers: { 'x-tenant-id': input.tenantId } as any,
      body: JSON.stringify({
        metadata: {
          healthScore: input.healthScore,
          healthReason: input.reason,
          healthRecommendation: input.recommendation,
          lastHealthCheck: new Date().toISOString(),
        },
      }),
    });
    return `Deal health updated to ${input.healthScore}. ${input.recommendation}`;
  },
});

export const updateOpportunityStage = tool({
  name: 'update_opportunity_stage',
  description: 'ย้าย Opportunity ไป stage ใหม่ เช่น Proposal → Negotiation',
  inputSchema: z.object({
    tenantId: z.string(),
    opportunityId: z.string(),
    newStageId: z.string().describe('Pipeline Stage ID ใหม่'),
    reason: z.string().optional().describe('เหตุผลที่ย้าย stage'),
  }),
  callback: async (input) => {
    const data = await apiCall(SALES_API, `/opportunities/${input.opportunityId}`, {
      method: 'PATCH',
      headers: { 'x-tenant-id': input.tenantId } as any,
      body: JSON.stringify({
        stageId: input.newStageId,
      }),
    });
    return JSON.stringify(data);
  },
});

export const closeOpportunity = tool({
  name: 'close_opportunity',
  description: 'ปิด Deal — Won หรือ Lost พร้อมบันทึกเหตุผล',
  inputSchema: z.object({
    tenantId: z.string(),
    opportunityId: z.string(),
    outcome: z.string().describe('won หรือ lost'),
    reason: z.string().describe('เหตุผลที่ชนะ/แพ้'),
    notes: z.string().optional().describe('รายละเอียดเพิ่มเติม'),
  }),
  callback: async (input) => {
    const stageEndpoint = input.outcome === 'won' ? 'close-won' : 'close-lost';
    const data = await apiCall(SALES_API, `/opportunities/${input.opportunityId}/${stageEndpoint}`, {
      method: 'POST',
      headers: { 'x-tenant-id': input.tenantId } as any,
      body: JSON.stringify({
        closedReason: input.reason,
        closedNotes: input.notes,
      }),
    });
    return JSON.stringify(data);
  },
});

export const getOpportunityHistory = tool({
  name: 'get_opportunity_history',
  description: 'ดึงประวัติการเปลี่ยนแปลงของ Opportunity (stage changes, value changes)',
  inputSchema: z.object({
    tenantId: z.string(),
    opportunityId: z.string(),
  }),
  callback: async (input) => {
    const data = await apiCall(SALES_API, `/opportunities/${input.opportunityId}/history`, {
      headers: { 'x-tenant-id': input.tenantId } as any,
    });
    return JSON.stringify(data);
  },
});

export const getStaleDeals = tool({
  name: 'get_stale_deals',
  description: 'ดึง Deal ที่อยู่ stage เดิมนานเกินค่าเฉลี่ย (stale/stuck deals)',
  inputSchema: z.object({
    tenantId: z.string(),
    daysThreshold: z.number().optional().default(14).describe('จำนวนวันที่ถือว่า stale'),
  }),
  callback: async (input) => {
    const data = await apiCall(SALES_API, `/opportunities/stale?days=${input.daysThreshold}`, {
      headers: { 'x-tenant-id': input.tenantId } as any,
    });
    return JSON.stringify(data);
  },
});

export const getAccountActivities = tool({
  name: 'get_account_activities',
  description: 'ดึง Activity Timeline ของ Account เพื่อดูว่ามี engagement ล่าสุดเมื่อไหร่',
  inputSchema: z.object({
    tenantId: z.string(),
    accountId: z.string(),
    limit: z.number().optional().default(10),
  }),
  callback: async (input) => {
    const data = await apiCall(CRM_API, `/accounts/${input.accountId}/activities?limit=${input.limit}`, {
      headers: { 'x-tenant-id': input.tenantId } as any,
    });
    return JSON.stringify(data);
  },
});
