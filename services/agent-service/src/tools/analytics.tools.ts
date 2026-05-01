/**
 * Analytics Tools — น้องวิ uses these to query real CRM data for analysis.
 */
import { tool } from '@strands-agents/sdk';
import { z } from 'zod';

const SALES_API = process.env.SALES_API_URL || 'http://localhost:3003';
const CRM_API = process.env.CRM_API_URL || 'http://localhost:3002';

async function apiCall(baseUrl: string, path: string, headers: Record<string, string> = {}) {
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

export const getKpiSummary = tool({
  name: 'get_kpi_summary',
  description: 'ดึงข้อมูล KPI สรุป: pipeline value, closed won, conversion rate, active customers',
  inputSchema: z.object({
    tenantId: z.string(),
    period: z.string().default('month').describe('month, quarter, year'),
  }),
  callback: async (input) => {
    const data = await apiCall(SALES_API, `/dashboard/kpi?period=${input.period}`, {
      'x-tenant-id': input.tenantId,
    });
    return JSON.stringify(data);
  },
});

export const getPipelineAnalysis = tool({
  name: 'get_pipeline_analysis',
  description: 'วิเคราะห์ pipeline: จำนวน deal แต่ละ stage, มูลค่ารวม, conversion rate ระหว่าง stage',
  inputSchema: z.object({
    tenantId: z.string(),
  }),
  callback: async (input) => {
    const data = await apiCall(SALES_API, '/dashboard/pipeline-analysis', {
      'x-tenant-id': input.tenantId,
    });
    return JSON.stringify(data);
  },
});

export const getRevenueData = tool({
  name: 'get_revenue_data',
  description: 'ดึงข้อมูล revenue รายเดือน สำหรับ forecast และ trend analysis',
  inputSchema: z.object({
    tenantId: z.string(),
    year: z.number().optional().describe('ปี ค.ศ. เช่น 2026'),
  }),
  callback: async (input) => {
    const params = input.year ? `?year=${input.year}` : '';
    const data = await apiCall(SALES_API, `/dashboard/revenue${params}`, {
      'x-tenant-id': input.tenantId,
    });
    return JSON.stringify(data);
  },
});

export const getSalesRepPerformance = tool({
  name: 'get_sales_rep_performance',
  description: 'เปรียบเทียบผลงาน Sales Rep: revenue, จำนวน deal, win rate, avg deal size',
  inputSchema: z.object({
    tenantId: z.string(),
    period: z.string().optional().default('month'),
  }),
  callback: async (input) => {
    const data = await apiCall(SALES_API, `/dashboard/rep-performance?period=${input.period}`, {
      'x-tenant-id': input.tenantId,
    });
    return JSON.stringify(data);
  },
});

export const getChurnRiskAccounts = tool({
  name: 'get_churn_risk_accounts',
  description: 'ดึงรายชื่อลูกค้าที่เสี่ยงหาย (ไม่ติดต่อนาน, revenue ลดลง)',
  inputSchema: z.object({
    tenantId: z.string(),
    daysInactive: z.number().optional().default(30).describe('จำนวนวันที่ไม่มี activity'),
  }),
  callback: async (input) => {
    const data = await apiCall(CRM_API, `/accounts/churn-risk?daysInactive=${input.daysInactive}`, {
      'x-tenant-id': input.tenantId,
    });
    return JSON.stringify(data);
  },
});

export const getSalesCycleAnalysis = tool({
  name: 'get_sales_cycle_analysis',
  description: 'วิเคราะห์ sales cycle: ระยะเวลาเฉลี่ยแต่ละ stage, bottleneck',
  inputSchema: z.object({
    tenantId: z.string(),
  }),
  callback: async (input) => {
    const data = await apiCall(SALES_API, '/dashboard/sales-cycle', {
      'x-tenant-id': input.tenantId,
    });
    return JSON.stringify(data);
  },
});

export const getForecast = tool({
  name: 'get_forecast',
  description: 'พยากรณ์ revenue จาก pipeline ปัจจุบัน: best case, expected, worst case',
  inputSchema: z.object({
    tenantId: z.string(),
  }),
  callback: async (input) => {
    const data = await apiCall(SALES_API, '/dashboard/forecast', {
      'x-tenant-id': input.tenantId,
    });
    return JSON.stringify(data);
  },
});
