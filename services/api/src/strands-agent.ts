/**
 * SalesFAST 7 — Strands SDK v1.2 Agents
 * Drop-in replacement for runAgentTask — same prompts, same tools, same behavior
 */
import { Agent, tool } from '@strands-agents/sdk';
import { BedrockModel } from '@strands-agents/sdk';
import { z } from 'zod';

// Patch: Bedrock doesn't accept $schema field in tool inputSchema
const _origToJSON = z.toJSONSchema;
(z as any).toJSONSchema = (schema: any, ...args: any[]) => {
  const result = _origToJSON(schema, ...args);
  delete result['$schema'];
  return result;
};
import { query } from './lib/db.js';

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-4-6';
const REGION = process.env.BEDROCK_REGION || 'ap-southeast-1';
const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';

// ══════════════════════════════════════════════════════════════
// Tools (same as current agents.ts)
// ══════════════════════════════════════════════════════════════

const searchLeads = tool({ name: 'search_leads', description: 'ค้นหา Lead ตาม status หรือ keyword', inputSchema: z.object({ status: z.string().optional(), search: z.string().optional(), limit: z.number().optional().default(10) }),
  callback: async (input) => { const tid=DEFAULT_TENANT; let w='tenant_id=$1',p:any[]=[tid],x=2; if(input.status){w+=` AND status=$${x}`;p.push(input.status);x++;} if(input.search){w+=` AND (name ILIKE $${x} OR company_name ILIKE $${x})`;p.push(`%${input.search}%`);x++;} p.push(Math.min(input.limit||10,20)); const r=await query(tid,`SELECT id,name,company_name,status,source,assigned_to,(metadata->>'estimatedValue') as value FROM leads WHERE ${w} ORDER BY created_at DESC LIMIT $${x}`,p); return JSON.stringify(r.rows); }});

const getLeadDetail = tool({ name: 'get_lead_detail', description: 'ดูรายละเอียด Lead + Sales Rep', inputSchema: z.object({ lead_id: z.string().optional(), search: z.string().optional() }),
  callback: async (input) => { const tid=DEFAULT_TENANT; if(input.lead_id){const r=await query(tid,`SELECT l.*,u.first_name||' '||u.last_name as rep_name FROM leads l LEFT JOIN users u ON u.id=l.assigned_to WHERE l.id=$1 AND l.tenant_id=$2`,[input.lead_id,tid]);return JSON.stringify(r.rows);} if(input.search){const r=await query(tid,`SELECT l.*,u.first_name||' '||u.last_name as rep_name FROM leads l LEFT JOIN users u ON u.id=l.assigned_to WHERE l.tenant_id=$1 AND (l.name ILIKE $2 OR l.company_name ILIKE $2) LIMIT 5`,[tid,`%${input.search}%`]);return JSON.stringify(r.rows);} return '[]'; }});

const createLead = tool({ name: 'create_lead', description: 'สร้าง Lead ใหม่ ต้องมี name + phone', inputSchema: z.object({ name: z.string(), company_name: z.string().optional(), phone: z.string().optional(), email: z.string().optional(), source: z.string().optional().default('ai_chat'), notes: z.string().optional() }),
  callback: async (input) => { const tid=DEFAULT_TENANT; const meta=JSON.stringify({notes:input.notes||''}); const r=await query(tid,`INSERT INTO leads(tenant_id,name,company_name,phone,email,source,status,metadata) VALUES($1,$2,$3,$4,$5,$6,'New',$7) RETURNING id,name,status`,[tid,input.name,input.company_name||null,input.phone||null,input.email||null,input.source,meta]); return `สร้าง Lead สำเร็จ: ${JSON.stringify(r.rows[0])}`; }});

const assignLead = tool({ name: 'assign_lead', description: 'มอบหมาย Lead ให้ Sales Rep', inputSchema: z.object({ lead_id: z.string(), assigned_to: z.string() }),
  callback: async (input) => { const tid=DEFAULT_TENANT; const r=await query(tid,`UPDATE leads SET assigned_to=$1,status='Contacted',updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING id,name,status`,[input.assigned_to,input.lead_id,tid]); return r.rows[0]?`Assign สำเร็จ: ${JSON.stringify(r.rows[0])}`:'ไม่พบ Lead'; }});

const getAccounts = tool({ name: 'get_accounts', description: 'ค้นหาลูกค้า (Accounts)', inputSchema: z.object({ search: z.string().optional(), limit: z.number().optional().default(10) }),
  callback: async (input) => { const tid=DEFAULT_TENANT; let w='tenant_id=$1 AND deleted_at IS NULL',p:any[]=[tid],x=2; if(input.search){w+=` AND (company_name ILIKE $${x} OR phone ILIKE $${x})`;p.push(`%${input.search}%`);x++;} p.push(Math.min(input.limit||10,20)); const r=await query(tid,`SELECT id,company_name,account_status,account_tier,total_revenue FROM accounts WHERE ${w} ORDER BY total_revenue DESC NULLS LAST LIMIT $${x}`,p); return JSON.stringify(r.rows); }});

const getUsers = tool({ name: 'get_users', description: 'ดูรายชื่อ Sales Reps ทั้งหมด', inputSchema: z.object({ query: z.string().optional().describe("optional filter") }),
  callback: async () => { const tid=DEFAULT_TENANT; const r=await query(tid,`SELECT u.id,u.first_name||' '||u.last_name as name,u.email,u.phone FROM users u WHERE u.tenant_id=$1 AND u.is_active=true ORDER BY u.first_name`,[tid]); return JSON.stringify(r.rows); }});

const getTasks = tool({ name: 'get_tasks', description: 'ดู Tasks ตาม status/overdue', inputSchema: z.object({ status: z.string().optional(), overdue_only: z.boolean().optional() }),
  callback: async (input) => { const tid=DEFAULT_TENANT; let w='tenant_id=$1',p:any[]=[tid],x=2; if(input.status){w+=` AND status=$${x}`;p.push(input.status);x++;} if(input.overdue_only)w+=` AND due_date<NOW() AND status!='Completed'`; p.push(10); const r=await query(tid,`SELECT id,title,status,priority,due_date FROM tasks WHERE ${w} ORDER BY due_date ASC LIMIT $${x}`,p); return JSON.stringify(r.rows); }});

const createTask = tool({ name: 'create_task', description: 'สร้าง Task ใหม่', inputSchema: z.object({ title: z.string(), due_date: z.string(), assigned_to: z.string(), priority: z.string().optional().default('Medium') }),
  callback: async (input) => { const tid=DEFAULT_TENANT; const r=await query(tid,`INSERT INTO tasks(tenant_id,title,due_date,priority,status,assigned_to) VALUES($1,$2,$3,$4,'Open',$5) RETURNING id,title,status`,[tid,input.title,input.due_date,input.priority,input.assigned_to]); return `สร้าง Task สำเร็จ: ${JSON.stringify(r.rows[0])}`; }});

const getProducts = tool({ name: 'get_products', description: 'ค้นหาสินค้า/บริการ', inputSchema: z.object({ search: z.string().optional() }),
  callback: async (input) => { const tid=DEFAULT_TENANT; let w='tenant_id=$1 AND is_active=true',p:any[]=[tid],x=2; if(input.search){w+=` AND (name ILIKE $${x} OR sku ILIKE $${x})`;p.push(`%${input.search}%`);x++;} const r=await query(tid,`SELECT id,name,sku,description,unit_price FROM products WHERE ${w} ORDER BY name LIMIT 10`,p); return JSON.stringify(r.rows); }});

const getPipelineSummary = tool({ name: 'get_pipeline_summary', description: 'สรุป Pipeline แต่ละ stage + มูลค่า', inputSchema: z.object({ query: z.string().optional().describe("optional filter") }),
  callback: async () => { const tid=DEFAULT_TENANT; const r=await query(tid,`SELECT status,count(*) as count,COALESCE(sum((metadata->>'estimatedValue')::numeric),0) as total_value FROM leads WHERE tenant_id=$1 GROUP BY status`,[tid]); return JSON.stringify(r.rows); }});

const getKpiSummary = tool({ name: 'get_kpi_summary', description: 'สรุป KPI ทั้งหมด', inputSchema: z.object({ query: z.string().optional().describe("optional filter") }),
  callback: async () => { const tid=DEFAULT_TENANT; const [l,a,t,q]=await Promise.all([query(tid,`SELECT count(*) as total,count(*) FILTER(WHERE status='Won') as won FROM leads WHERE tenant_id=$1`,[tid]),query(tid,`SELECT count(*) as total FROM accounts WHERE tenant_id=$1 AND deleted_at IS NULL AND account_status='active'`,[tid]),query(tid,`SELECT count(*) as total,count(*) FILTER(WHERE status!='Completed' AND due_date<NOW()) as overdue FROM tasks WHERE tenant_id=$1`,[tid]),query(tid,`SELECT count(*) as total,COALESCE(sum(grand_total),0) as value FROM quotations WHERE tenant_id=$1`,[tid])]); return JSON.stringify({leads:l.rows[0],activeAccounts:a.rows[0].total,tasks:t.rows[0],quotations:q.rows[0]}); }});

const getSalesPerformance = tool({ name: 'get_sales_performance', description: 'ผลงาน Sales Rep แต่ละคน', inputSchema: z.object({ query: z.string().optional().describe("optional filter") }),
  callback: async () => { const tid=DEFAULT_TENANT; const r=await query(tid,`SELECT u.id,u.first_name||' '||u.last_name as name,(SELECT count(*) FROM leads l WHERE l.assigned_to=u.id) as total_leads,(SELECT count(*) FROM leads l WHERE l.assigned_to=u.id AND l.status='Won') as won_leads FROM users u WHERE u.tenant_id=$1 AND u.is_active=true ORDER BY total_leads DESC`,[tid]); return JSON.stringify(r.rows); }});

// ══════════════════════════════════════════════════════════════
// Prompts (same as current)
// ══════════════════════════════════════════════════════════════

const SALES_PROMPT = `คุณคือ "น้องขายไว" Sales Personal Assistant ตอบภาษาไทยสุภาพ ใช้ค่ะ

กฎการตอบ:
- ตอบเป็นประโยคธรรมชาติเหมือนคนพูดคุยกัน เว้นบรรทัดแบ่งย่อหน้าให้อ่านง่าย
- ห้ามใช้ emoji เด็ดขาด
- ห้ามใช้ heading markdown (##, ###) เด็ดขาด
- ห้ามใช้ตาราง markdown (| --- |) เด็ดขาด
- ห้ามใช้ bold (**text**) เด็ดขาด
- ห้ามใช้ bullet points ที่ขึ้นต้นด้วย - หรือ * ให้เขียนเป็นประโยคต่อเนื่องแทน
- ตอบสั้นกระชับ ไม่เกิน 6-8 บรรทัด
- ห้ามแสดง UUID/ID แปลงเป็นชื่อเสมอ
- ใช้ tools ดึงข้อมูลจริงเสมอ ห้ามเดา
- ทำ action ได้เลย เช่น สร้าง Lead, สร้าง Task, Assign Lead
- ถ้าข้อมูลไม่ครบ ให้ถามกลับ
- จบด้วยคำแนะนำ next action เมื่อเหมาะสม`;

const ANALYTICS_PROMPT = `คุณคือ "น้องวิ" นักวิเคราะห์ข้อมูลการขาย ตอบภาษาไทยสุภาพ ใช้ค่ะ

กฎการตอบ:
- ตอบเป็นประโยคธรรมชาติเหมือนคนพูดคุยกัน เว้นบรรทัดแบ่งย่อหน้าให้อ่านง่าย
- ห้ามใช้ emoji เด็ดขาด
- ห้ามใช้ heading markdown (##, ###) เด็ดขาด
- ห้ามใช้ตาราง markdown (| --- |) เด็ดขาด
- ห้ามใช้ bold (**text**) เด็ดขาด
- ห้ามใช้ bullet points ที่ขึ้นต้นด้วย - หรือ * ให้เขียนเป็นประโยคต่อเนื่องแทน
- ตอบสั้นกระชับ ไม่เกิน 6-8 บรรทัด
- ห้ามแสดง UUID/ID
- ใช้ tools ดึงข้อมูลจริงเสมอ ห้ามสมมติ
- เริ่มด้วยสรุปภาพรวม 1-2 ประโยค ตามด้วยรายละเอียด จบด้วยคำแนะนำ`;

// ══════════════════════════════════════════════════════════════
// Agent instances (cached)
// ══════════════════════════════════════════════════════════════

const ALL_TOOLS = [searchLeads, getLeadDetail, createLead, assignLead, getAccounts, getUsers, getTasks, createTask, getProducts, getPipelineSummary, getKpiSummary, getSalesPerformance];
const ANALYTICS_TOOLS = [getPipelineSummary, getKpiSummary, getSalesPerformance, searchLeads, getAccounts];

let salesAgent: Agent | null = null;
let analyticsAgent: Agent | null = null;

function getSalesAgent(): Agent {
  if (!salesAgent) {
    salesAgent = new Agent({ model: new BedrockModel({ modelId: 'global.anthropic.claude-sonnet-4-6', region: 'ap-southeast-1' }), tools: ALL_TOOLS, systemPrompt: SALES_PROMPT, printer: false });
  }
  return salesAgent;
}

function getAnalyticsAgent(): Agent {
  if (!analyticsAgent) {
    analyticsAgent = new Agent({ model: new BedrockModel({ modelId: 'global.anthropic.claude-sonnet-4-6', region: 'ap-southeast-1' }), tools: ANALYTICS_TOOLS, systemPrompt: ANALYTICS_PROMPT, printer: false });
  }
  return analyticsAgent;
}

// ══════════════════════════════════════════════════════════════
// Export — drop-in replacement for runAgentTask
// ══════════════════════════════════════════════════════════════

export function detectAgentType(message: string): string {
  const l = message.toLowerCase();
  if (['forecast','พยากรณ์','churn','win rate','conversion','เปรียบเทียบ','performance','ผลงาน','revenue','kpi','วิเคราะห์','pipeline','สรุปยอด'].some(k => l.includes(k))) return 'analytics';
  return 'sales';
}

export function getAgentDisplayName(t: string): string {
  return t === 'analytics' ? 'น้องวิ' : 'น้องขายไว';
}

export async function runStrandsAgent(message: string, agentType: string, _tenantId: string): Promise<string> {
  const agent = agentType === 'analytics' ? getAnalyticsAgent() : getSalesAgent();
  const result = await agent.invoke(message);
  return result.lastMessage || '';
}
