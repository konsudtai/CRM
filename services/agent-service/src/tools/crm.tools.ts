/**
 * CRM Tools — น้องขายไว uses these to interact with the CRM system.
 * Each tool calls the real CRM/Sales/Quotation APIs.
 */
import { tool } from '@strands-agents/sdk';
import { z } from 'zod';

const CRM_API = process.env.CRM_API_URL || 'http://localhost:3002';
const SALES_API = process.env.SALES_API_URL || 'http://localhost:3003';
const QUOTATION_API = process.env.QUOTATION_API_URL || 'http://localhost:3004';

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

// ── Lead Management ──

export const searchLeads = tool({
  name: 'search_leads',
  description: 'ค้นหา Lead ใน pipeline ตาม status, ชื่อ, หรือ assigned rep. ใช้เมื่อต้องการดูรายการ Lead',
  inputSchema: z.object({
    tenantId: z.string().describe('Tenant ID'),
    status: z.string().optional().describe('Filter by status: New, Contacted, Qualified, Proposal, Negotiation, Won, Lost'),
    assignedTo: z.string().optional().describe('Filter by assigned sales rep user ID'),
    search: z.string().optional().describe('Search by name or company'),
    limit: z.number().optional().default(10),
  }),
  callback: async (input) => {
    const params = new URLSearchParams();
    if (input.status) params.set('status', input.status);
    if (input.assignedTo) params.set('assignedTo', input.assignedTo);
    if (input.search) params.set('search', input.search);
    params.set('limit', String(input.limit));
    const data = await apiCall(SALES_API, `/leads?${params}`, {
      headers: { 'x-tenant-id': input.tenantId } as any,
    });
    return JSON.stringify(data);
  },
});

export const assignLead = tool({
  name: 'assign_lead',
  description: 'มอบหมาย Lead ให้ Sales Rep. ใช้เมื่อ Manager สั่ง assign lead ให้คนใดคนหนึ่ง',
  inputSchema: z.object({
    tenantId: z.string(),
    leadId: z.string().describe('Lead ID to assign'),
    assignToUserId: z.string().describe('User ID of the sales rep'),
    assignToName: z.string().describe('Name of the sales rep (for confirmation message)'),
  }),
  callback: async (input) => {
    await apiCall(SALES_API, `/leads/${input.leadId}`, {
      method: 'PATCH',
      headers: { 'x-tenant-id': input.tenantId } as any,
      body: JSON.stringify({ assignedTo: input.assignToUserId, status: 'Contacted' }),
    });
    return `Lead ${input.leadId} assigned to ${input.assignToName} successfully. Status updated to Contacted.`;
  },
});

export const createLead = tool({
  name: 'create_lead',
  description: 'สร้าง Lead ใหม่ในระบบ ใช้เมื่อได้ข้อมูลลูกค้าใหม่จาก LINE หรือช่องทางอื่น',
  inputSchema: z.object({
    tenantId: z.string(),
    name: z.string().describe('ชื่อลูกค้า'),
    companyName: z.string().optional().describe('ชื่อบริษัท'),
    email: z.string().optional(),
    phone: z.string().optional(),
    lineId: z.string().optional().describe('LINE User ID'),
    source: z.string().default('line').describe('แหล่งที่มา: line, website, referral, cold_call'),
    notes: z.string().optional().describe('รายละเอียดเพิ่มเติม เช่น สนใจสินค้าอะไร'),
  }),
  callback: async (input) => {
    const data = await apiCall(SALES_API, '/leads', {
      method: 'POST',
      headers: { 'x-tenant-id': input.tenantId } as any,
      body: JSON.stringify(input),
    });
    return JSON.stringify(data);
  },
});

// ── Account & Contact ──

export const searchAccounts = tool({
  name: 'search_accounts',
  description: 'ค้นหาข้อมูลลูกค้า (Account) ตามชื่อบริษัท, อุตสาหกรรม',
  inputSchema: z.object({
    tenantId: z.string(),
    search: z.string().describe('ชื่อบริษัทหรือ keyword'),
    limit: z.number().optional().default(5),
  }),
  callback: async (input) => {
    const data = await apiCall(CRM_API, `/accounts?search=${encodeURIComponent(input.search)}&limit=${input.limit}`, {
      headers: { 'x-tenant-id': input.tenantId } as any,
    });
    return JSON.stringify(data);
  },
});

export const getAccountDetail = tool({
  name: 'get_account_detail',
  description: 'ดูรายละเอียดลูกค้า (Account) รวมถึง contacts, revenue, activities',
  inputSchema: z.object({
    tenantId: z.string(),
    accountId: z.string(),
  }),
  callback: async (input) => {
    const data = await apiCall(CRM_API, `/accounts/${input.accountId}`, {
      headers: { 'x-tenant-id': input.tenantId } as any,
    });
    return JSON.stringify(data);
  },
});

// ── Quotation ──

export const createQuotation = tool({
  name: 'create_quotation',
  description: 'สร้างใบเสนอราคา (Quotation) ใหม่ ใช้เมื่อ Sales ต้องการออก QT ให้ลูกค้า',
  inputSchema: z.object({
    tenantId: z.string(),
    accountId: z.string().describe('Account ID ของลูกค้า'),
    contactId: z.string().optional().describe('Contact ID ของผู้ติดต่อ'),
    lineItems: z.array(z.object({
      productId: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      discount: z.number().optional().default(0),
    })).describe('รายการสินค้าในใบเสนอราคา'),
    notes: z.string().optional().describe('หมายเหตุเพิ่มเติม'),
    validDays: z.number().optional().default(30).describe('จำนวนวันที่ QT มีผล'),
  }),
  callback: async (input) => {
    const data = await apiCall(QUOTATION_API, '/quotations', {
      method: 'POST',
      headers: { 'x-tenant-id': input.tenantId } as any,
      body: JSON.stringify(input),
    });
    return JSON.stringify(data);
  },
});

export const getQuotation = tool({
  name: 'get_quotation',
  description: 'ดูรายละเอียดใบเสนอราคา ตาม QT number หรือ ID',
  inputSchema: z.object({
    tenantId: z.string(),
    quotationId: z.string().optional(),
    quotationNumber: z.string().optional().describe('เลขที่ QT เช่น QT-2569-0001'),
  }),
  callback: async (input) => {
    const id = input.quotationId || input.quotationNumber;
    const data = await apiCall(QUOTATION_API, `/quotations/${id}`, {
      headers: { 'x-tenant-id': input.tenantId } as any,
    });
    return JSON.stringify(data);
  },
});

export const approveQuotation = tool({
  name: 'approve_quotation',
  description: 'อนุมัติใบเสนอราคา (เฉพาะ Sales Manager/Admin)',
  inputSchema: z.object({
    tenantId: z.string(),
    quotationId: z.string(),
    approvedBy: z.string().describe('User ID ของผู้อนุมัติ'),
  }),
  callback: async (input) => {
    const data = await apiCall(QUOTATION_API, `/quotations/${input.quotationId}/approve`, {
      method: 'POST',
      headers: { 'x-tenant-id': input.tenantId } as any,
      body: JSON.stringify({ approvedBy: input.approvedBy }),
    });
    return JSON.stringify(data);
  },
});

export const searchProducts = tool({
  name: 'search_products',
  description: 'ค้นหาสินค้าในแคตตาล็อก ตามชื่อ, หมวดหมู่, หรือช่วงราคา',
  inputSchema: z.object({
    tenantId: z.string(),
    search: z.string().optional().describe('ชื่อสินค้าหรือ keyword'),
    category: z.string().optional(),
    limit: z.number().optional().default(10),
  }),
  callback: async (input) => {
    const params = new URLSearchParams();
    if (input.search) params.set('search', input.search);
    if (input.category) params.set('category', input.category);
    params.set('limit', String(input.limit));
    const data = await apiCall(QUOTATION_API, `/products?${params}`, {
      headers: { 'x-tenant-id': input.tenantId } as any,
    });
    return JSON.stringify(data);
  },
});

// ── Tasks ──

export const searchTasks = tool({
  name: 'search_tasks',
  description: 'ค้นหา Task/งาน ตาม status, assigned user, หรือ overdue',
  inputSchema: z.object({
    tenantId: z.string(),
    assignedTo: z.string().optional(),
    status: z.string().optional().describe('Open, In Progress, Completed, Overdue'),
    overdue: z.boolean().optional().describe('true = เฉพาะงานเกินกำหนด'),
    limit: z.number().optional().default(10),
  }),
  callback: async (input) => {
    const params = new URLSearchParams();
    if (input.assignedTo) params.set('assignedTo', input.assignedTo);
    if (input.status) params.set('status', input.status);
    if (input.overdue) params.set('overdue', 'true');
    params.set('limit', String(input.limit));
    const data = await apiCall(CRM_API, `/tasks?${params}`, {
      headers: { 'x-tenant-id': input.tenantId } as any,
    });
    return JSON.stringify(data);
  },
});

export const createTask = tool({
  name: 'create_task',
  description: 'สร้าง Task ใหม่ เช่น นัดโทรลูกค้า, follow-up, ส่งเอกสาร',
  inputSchema: z.object({
    tenantId: z.string(),
    title: z.string(),
    description: z.string().optional(),
    assignedTo: z.string().describe('User ID ที่รับผิดชอบ'),
    dueDate: z.string().describe('วันครบกำหนด YYYY-MM-DD'),
    priority: z.string().optional().default('Medium').describe('High, Medium, Low'),
    relatedAccountId: z.string().optional(),
    relatedLeadId: z.string().optional(),
  }),
  callback: async (input) => {
    const data = await apiCall(CRM_API, '/tasks', {
      method: 'POST',
      headers: { 'x-tenant-id': input.tenantId } as any,
      body: JSON.stringify(input),
    });
    return JSON.stringify(data);
  },
});

// ── Opportunities ──

export const searchOpportunities = tool({
  name: 'search_opportunities',
  description: 'ค้นหา Opportunity/Deal ใน pipeline',
  inputSchema: z.object({
    tenantId: z.string(),
    stage: z.string().optional().describe('Pipeline stage name'),
    ownerId: z.string().optional(),
    limit: z.number().optional().default(10),
  }),
  callback: async (input) => {
    const params = new URLSearchParams();
    if (input.stage) params.set('stage', input.stage);
    if (input.ownerId) params.set('ownerId', input.ownerId);
    params.set('limit', String(input.limit));
    const data = await apiCall(SALES_API, `/opportunities?${params}`, {
      headers: { 'x-tenant-id': input.tenantId } as any,
    });
    return JSON.stringify(data);
  },
});

export const draftEmail = tool({
  name: 'draft_email',
  description: 'เขียน email ให้ Sales ส่งลูกค้า เช่น follow-up, แนะนำสินค้า, ส่ง QT',
  inputSchema: z.object({
    recipientName: z.string(),
    recipientCompany: z.string().optional(),
    purpose: z.string().describe('วัตถุประสงค์: follow_up, product_intro, quotation_send, thank_you, meeting_request'),
    context: z.string().optional().describe('ข้อมูลเพิ่มเติม เช่น สินค้าที่สนใจ, มูลค่า deal'),
    language: z.string().optional().default('th').describe('th = ภาษาไทย, en = English'),
  }),
  callback: async (input) => {
    // This tool returns instructions for the LLM to compose the email
    return `Please compose a professional ${input.language === 'th' ? 'Thai' : 'English'} email for:
      Recipient: ${input.recipientName} (${input.recipientCompany || 'N/A'})
      Purpose: ${input.purpose}
      Context: ${input.context || 'None'}
      Use polite Thai business language with ครับ/ค่ะ if Thai.`;
  },
});
