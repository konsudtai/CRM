/**
 * AI Agents Route — น้องขายไว Full Agent with Tools
 *
 * Features:
 *   - 14 CRM tools (read + write): leads, accounts, tasks, quotations, pipeline, KPI
 *   - Conversational: asks follow-up questions when data is incomplete
 *   - AgentCore primary + Bedrock Converse fallback
 *   - Event-driven: handles SQS domain events (lead.created, task.overdue, etc.)
 *   - Reads AI config from DynamoDB (model, region, credentials from Settings UI)
 */
import { Hono } from 'hono';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { query } from '../lib/db.js';

const agents = new Hono();

const AGENTCORE_ARN = process.env.AGENTCORE_RUNTIME_ARN || '';
const ADMIN_AI_ARN = process.env.ADMIN_AI_RUNTIME_ARN || '';
const ANALYTICS_ARN = process.env.ANALYTICS_RUNTIME_ARN || '';
// Strands Runtimes (Phase 3) — override old runtimes
const SALES_STRANDS_ARN = process.env.SALES_STRANDS_RUNTIME_ARN || '';
const ANALYTICS_STRANDS_ARN = process.env.ANALYTICS_STRANDS_RUNTIME_ARN || '';
function getAgentArn(agentType: string) {
  // Prefer new Strands runtimes if configured
  if (agentType === 'analytics') return ANALYTICS_STRANDS_ARN || ANALYTICS_ARN || AGENTCORE_ARN;
  // Sales + admin-ai → sales strands runtime (น้องแอ๊ดไม่ใช้ AI, but fallback)
  return SALES_STRANDS_ARN || AGENTCORE_ARN;
}
const AGENTCORE_REGION = process.env.AGENTCORE_REGION || process.env.BEDROCK_REGION || 'ap-southeast-1';
const DEFAULT_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-4-6';
const DEFAULT_REGION = process.env.BEDROCK_REGION || 'ap-southeast-1';
const USE_AGENTCORE = process.env.USE_AGENTCORE !== 'false' && !!AGENTCORE_ARN;
const AGENTCORE_TIMEOUT_MS = parseInt(process.env.AGENTCORE_TIMEOUT_MS || '120000'); // 120s — Fargate has no time limit, AgentCore cold start can take 30-60s
const MAX_ITERATIONS = 5;
const TIME_BUDGET_MS = 12000; // Bedrock Converse budget per iteration check (total must finish in ~14s)
const AI_STATE_TABLE = process.env.AI_STATE_TABLE || 'sf7-prod-ai-state';

// DynamoDB client for reading AI config
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });

// Cache AI config (refresh every 60s)
let cachedConfig: any = null;
let configLastFetched = 0;
const CONFIG_TTL_MS = 60000;

async function getAIConfig(tenantId: string): Promise<{ modelId: string; region: string; temperature: number; maxTokens: number }> {
  const now = Date.now();
  if (cachedConfig && (now - configLastFetched) < CONFIG_TTL_MS) {
    return cachedConfig;
  }

  try {
    const res = await ddbClient.send(new GetItemCommand({
      TableName: AI_STATE_TABLE,
      Key: { PK: { S: `TENANT#${tenantId}` }, SK: { S: 'CONFIG#ai' } },
    }));

    if (res.Item?.data?.S) {
      const cfg = JSON.parse(res.Item.data.S);
      cachedConfig = {
        modelId: cfg.chatModel || DEFAULT_MODEL_ID,
        region: cfg.bedrockRegion || DEFAULT_REGION,
        temperature: cfg.temperature !== undefined ? parseFloat(cfg.temperature) : 0.4,
        maxTokens: cfg.maxTokens ? parseInt(cfg.maxTokens) : 2048,
      };
      configLastFetched = now;
      return cachedConfig;
    }
  } catch (err: any) {
    console.warn('Failed to load AI config from DynamoDB:', err.message);
  }

  cachedConfig = {
    modelId: DEFAULT_MODEL_ID,
    region: DEFAULT_REGION,
    temperature: 0.4,
    maxTokens: 2048,
  };
  configLastFetched = now;
  return cachedConfig;
}

// ══════════════════════════════════════════════════════════════
// AgentCore Integration (primary path)
// ══════════════════════════════════════════════════════════════

async function invokeAgentCore(message: string, agentType: string, tenantId: string, sessionId?: string): Promise<{ reply: string; agentUsed: string; sessionId: string }> {
  const { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } = await import('@aws-sdk/client-bedrock-agentcore');
  const sid = sessionId && sessionId.length >= 33 ? sessionId : `sf7-session-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}pad`;
  const payload = JSON.stringify({ message, agentType, tenantId, sessionId: sid });
  const client = new BedrockAgentCoreClient({ region: AGENTCORE_REGION });
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), AGENTCORE_TIMEOUT_MS);
  let response: any;
  try {
    response = await client.send(new InvokeAgentRuntimeCommand({
      agentRuntimeArn: getAgentArn(agentType), runtimeSessionId: sid,
      payload: new TextEncoder().encode(payload),
      contentType: 'application/json',
      accept: 'application/json',
      qualifier: 'DEFAULT',
    }), { abortSignal: abortController.signal });
  } finally { clearTimeout(timeoutId); }

  console.log('[AgentCore] statusCode:', response.statusCode, 'contentType:', response.contentType);

  // Handle response — may be various formats from AgentCore SDK
  let responseBody = '';
  try {
    const r = response.response || response.body || response.payload;
    if (!r) {
      responseBody = '';
    } else if (typeof r === 'string') {
      responseBody = r;
    } else if (r instanceof Uint8Array || Buffer.isBuffer(r)) {
      responseBody = new TextDecoder().decode(r);
    } else if (typeof r.transformToString === 'function') {
      responseBody = await r.transformToString();
    } else if (typeof r.transformToByteArray === 'function') {
      const bytes = await r.transformToByteArray();
      responseBody = new TextDecoder().decode(bytes);
    } else if (typeof r[Symbol.asyncIterator] === 'function') {
      const chunks: Uint8Array[] = [];
      for await (const chunk of r) {
        if (chunk instanceof Uint8Array) chunks.push(chunk);
        else if (typeof chunk === 'string') chunks.push(new TextEncoder().encode(chunk));
        else if (chunk?.chunk?.bytes) chunks.push(new Uint8Array(chunk.chunk.bytes));
        else if (chunk?.body) chunks.push(typeof chunk.body === 'string' ? new TextEncoder().encode(chunk.body) : chunk.body);
      }
      if (chunks.length > 0) responseBody = new TextDecoder().decode(Buffer.concat(chunks));
    } else if (typeof r.read === 'function') {
      const chunks: Buffer[] = [];
      for await (const chunk of r) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      responseBody = Buffer.concat(chunks).toString('utf-8');
    } else {
      try { responseBody = JSON.stringify(r); } catch { responseBody = String(r); }
    }
  } catch (parseErr: any) {
    console.warn('[AgentCore] parse error:', parseErr.message);
    responseBody = '';
  }

  console.log('[AgentCore] responseBody length:', responseBody.length, 'preview:', responseBody.slice(0, 200));

  let data: any = {};
  try { data = responseBody ? JSON.parse(responseBody) : {}; } catch { data = { reply: responseBody }; }
  const output = data.output || data;
  return { reply: output.reply || output.message || output.text || responseBody.slice(0, 500) || 'AgentCore ตอบกลับแล้วแต่ไม่มีข้อความ', agentUsed: output.agentUsed || agentType, sessionId: sid };
}

// ══════════════════════════════════════════════════════════════
// CRM Tools — Full CRUD (14 tools)
// ══════════════════════════════════════════════════════════════

interface Tool { name: string; description: string; inputSchema: any; handler: (input: any, tid: string) => Promise<string>; }

const TOOLS: Tool[] = [
  // ── READ ──
  { name: 'get_leads', description: 'ค้นหา Leads ตาม status หรือ keyword', inputSchema: { json: { type: 'object', properties: { status: { type: 'string', description: 'New,Contacted,Qualified,Proposal,Negotiation,Won,Lost' }, search: { type: 'string' }, limit: { type: 'number' } } } },
    handler: async (i, tid) => { let w='tenant_id=$1',p:any[]=[tid],x=2; if(i.status){w+=` AND status=$${x}`;p.push(i.status);x++;} if(i.search){w+=` AND (name ILIKE $${x} OR company_name ILIKE $${x})`;p.push(`%${i.search}%`);x++;} p.push(Math.min(i.limit||10,20)); const r=await query(tid,`SELECT id,name,company_name,status,source,assigned_to,(metadata->>'estimatedValue') as value FROM leads WHERE ${w} ORDER BY created_at DESC LIMIT $${x}`,p); return JSON.stringify(r.rows); } },

  { name: 'get_lead_detail', description: 'ดูรายละเอียด Lead + Sales Rep ที่ดูแล', inputSchema: { json: { type: 'object', properties: { lead_id: { type: 'string' }, search: { type: 'string' } } } },
    handler: async (i, tid) => { if(i.lead_id){ const r=await query(tid,`SELECT l.*,u.first_name as rep_first,u.last_name as rep_last,u.email as rep_email,u.phone as rep_phone FROM leads l LEFT JOIN users u ON u.id=l.assigned_to WHERE l.id=$1 AND l.tenant_id=$2`,[i.lead_id,tid]); return JSON.stringify(r.rows); } if(i.search){ const r=await query(tid,`SELECT l.*,u.first_name as rep_first,u.last_name as rep_last,u.email as rep_email,u.phone as rep_phone FROM leads l LEFT JOIN users u ON u.id=l.assigned_to WHERE l.tenant_id=$1 AND (l.name ILIKE $2 OR l.company_name ILIKE $2 OR l.phone ILIKE $2) LIMIT 5`,[tid,`%${i.search}%`]); return JSON.stringify(r.rows); } return 'กรุณาระบุ lead_id หรือ search'; } },

  { name: 'get_accounts', description: 'ค้นหาลูกค้า (Accounts)', inputSchema: { json: { type: 'object', properties: { search: { type: 'string' }, limit: { type: 'number' } } } },
    handler: async (i, tid) => { let w='tenant_id=$1 AND deleted_at IS NULL',p:any[]=[tid],x=2; if(i.search){w+=` AND (company_name ILIKE $${x} OR phone ILIKE $${x})`;p.push(`%${i.search}%`);x++;} p.push(Math.min(i.limit||10,20)); const r=await query(tid,`SELECT id,company_name,account_status,account_tier,total_revenue,industry FROM accounts WHERE ${w} ORDER BY total_revenue DESC NULLS LAST LIMIT $${x}`,p); return JSON.stringify(r.rows); } },

  { name: 'get_account_detail', description: 'ดูรายละเอียดลูกค้า + contacts', inputSchema: { json: { type: 'object', properties: { account_id: { type: 'string' } }, required: ['account_id'] } },
    handler: async (i, tid) => { const a=await query(tid,`SELECT a.*,u.first_name||' '||u.last_name as owner_name,u.phone as owner_phone FROM accounts a LEFT JOIN users u ON u.id=a.account_owner WHERE a.id=$1`,[i.account_id]); const c=await query(tid,`SELECT first_name,last_name,title,phone,email FROM contacts WHERE account_id=$1 AND is_active=true`,[i.account_id]); return JSON.stringify({account:a.rows[0]||null,contacts:c.rows}); } },

  { name: 'get_users', description: 'ดูรายชื่อ Sales Reps ทั้งหมด', inputSchema: { json: { type: 'object', properties: {} } },
    handler: async (_i, tid) => { const r=await query(tid,`SELECT u.id,u.first_name||' '||u.last_name as name,u.email,u.phone,(SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id LIMIT 1) as role FROM users u WHERE u.tenant_id=$1 AND u.is_active=true ORDER BY u.first_name`,[tid]); return JSON.stringify(r.rows); } },

  { name: 'get_tasks', description: 'ดู Tasks ตาม status, assigned_to, overdue', inputSchema: { json: { type: 'object', properties: { status: { type: 'string' }, assigned_to: { type: 'string' }, overdue_only: { type: 'boolean' }, limit: { type: 'number' } } } },
    handler: async (i, tid) => { let w='tenant_id=$1',p:any[]=[tid],x=2; if(i.status){w+=` AND status=$${x}`;p.push(i.status);x++;} if(i.assigned_to){w+=` AND assigned_to=$${x}`;p.push(i.assigned_to);x++;} if(i.overdue_only) w+=` AND due_date<NOW() AND status!='Completed'`; p.push(Math.min(i.limit||10,20)); const r=await query(tid,`SELECT id,title,status,priority,due_date,assigned_to FROM tasks WHERE ${w} ORDER BY due_date ASC LIMIT $${x}`,p); return JSON.stringify(r.rows); } },

  { name: 'get_products', description: 'ค้นหาสินค้า/บริการ', inputSchema: { json: { type: 'object', properties: { search: { type: 'string' } } } },
    handler: async (i, tid) => { let w='tenant_id=$1 AND is_active=true',p:any[]=[tid],x=2; if(i.search){w+=` AND (name ILIKE $${x} OR sku ILIKE $${x})`;p.push(`%${i.search}%`);x++;} const r=await query(tid,`SELECT id,name,sku,description,unit_price FROM products WHERE ${w} ORDER BY name LIMIT 10`,p); return JSON.stringify(r.rows); } },

  { name: 'get_quotations', description: 'ดู Quotations ตาม status', inputSchema: { json: { type: 'object', properties: { status: { type: 'string' } } } },
    handler: async (i, tid) => { let w='q.tenant_id=$1',p:any[]=[tid],x=2; if(i.status){w+=` AND q.status=$${x}`;p.push(i.status);x++;} const r=await query(tid,`SELECT q.id,q.quotation_number,q.status,q.grand_total,a.company_name FROM quotations q LEFT JOIN accounts a ON a.id=q.account_id WHERE ${w} ORDER BY q.created_at DESC LIMIT 10`,p); return JSON.stringify(r.rows); } },

  { name: 'get_pipeline_summary', description: 'สรุป Pipeline แต่ละ stage + มูลค่า', inputSchema: { json: { type: 'object', properties: {} } },
    handler: async (_i, tid) => { const r=await query(tid,`SELECT status,count(*) as count,COALESCE(sum((metadata->>'estimatedValue')::numeric),0) as total_value FROM leads WHERE tenant_id=$1 GROUP BY status`,[tid]); return JSON.stringify(r.rows); } },

  { name: 'get_kpi_summary', description: 'สรุป KPI ทั้งหมด', inputSchema: { json: { type: 'object', properties: {} } },
    handler: async (_i, tid) => { const [l,a,t,q]=await Promise.all([query(tid,`SELECT count(*) as total,count(*) FILTER(WHERE status='Won') as won FROM leads WHERE tenant_id=$1`,[tid]),query(tid,`SELECT count(*) as total FROM accounts WHERE tenant_id=$1 AND deleted_at IS NULL AND account_status='active'`,[tid]),query(tid,`SELECT count(*) as total,count(*) FILTER(WHERE status!='Completed' AND due_date<NOW()) as overdue FROM tasks WHERE tenant_id=$1`,[tid]),query(tid,`SELECT count(*) as total,COALESCE(sum(grand_total),0) as value FROM quotations WHERE tenant_id=$1`,[tid])]); return JSON.stringify({leads:l.rows[0],activeAccounts:a.rows[0].total,tasks:t.rows[0],quotations:q.rows[0]}); } },

  { name: 'get_sales_rep_performance', description: 'ผลงาน Sales Rep แต่ละคน', inputSchema: { json: { type: 'object', properties: {} } },
    handler: async (_i, tid) => { const r=await query(tid,`SELECT u.id,u.first_name||' '||u.last_name as name,(SELECT count(*) FROM leads l WHERE l.assigned_to=u.id) as total_leads,(SELECT count(*) FROM leads l WHERE l.assigned_to=u.id AND l.status='Won') as won_leads,(SELECT count(*) FROM tasks t WHERE t.assigned_to=u.id AND t.status!='Completed') as open_tasks FROM users u WHERE u.tenant_id=$1 AND u.is_active=true ORDER BY total_leads DESC`,[tid]); return JSON.stringify(r.rows); } },

  // ── WRITE ──
  { name: 'create_lead', description: 'สร้าง Lead ใหม่ — ต้องมีอย่างน้อย name + (phone หรือ email) ถ้าข้อมูลไม่ครบให้ถามผู้ใช้ก่อน', inputSchema: { json: { type: 'object', properties: { name: { type: 'string', description: 'ชื่อผู้ติดต่อ (required)' }, company_name: { type: 'string', description: 'ชื่อบริษัท' }, email: { type: 'string' }, phone: { type: 'string' }, source: { type: 'string', description: 'แหล่งที่มา: website,line,referral,cold_call,ai_chat' }, notes: { type: 'string', description: 'รายละเอียด/สนใจอะไร' }, estimated_value: { type: 'number', description: 'งบประมาณ (บาท)' } }, required: ['name'] } },
    handler: async (i, tid) => { const meta:any={}; if(i.notes)meta.notes=i.notes; if(i.estimated_value)meta.estimatedValue=i.estimated_value; const r=await query(tid,`INSERT INTO leads(tenant_id,name,company_name,email,phone,source,status,metadata) VALUES($1,$2,$3,$4,$5,$6,'New',$7) RETURNING id,name,status,company_name`,[tid,i.name,i.company_name||null,i.email||null,i.phone||null,i.source||'ai_chat',JSON.stringify(meta)]); return `✅ สร้าง Lead สำเร็จ: ${JSON.stringify(r.rows[0])}`; } },

  { name: 'update_lead', description: 'อัพเดท Lead — เปลี่ยน status หรือ assign Sales Rep', inputSchema: { json: { type: 'object', properties: { lead_id: { type: 'string', description: 'Lead ID (required)' }, status: { type: 'string', description: 'New,Contacted,Qualified,Proposal,Negotiation,Won,Lost' }, assigned_to: { type: 'string', description: 'User ID ของ Sales Rep' } }, required: ['lead_id'] } },
    handler: async (i, tid) => { const s:string[]=[],v:any[]=[]; let x=1; if(i.status){s.push(`status=$${x}`);v.push(i.status);x++;} if(i.assigned_to){s.push(`assigned_to=$${x}`);v.push(i.assigned_to);x++;} if(!s.length) return 'ไม่มีข้อมูลที่จะอัพเดท กรุณาระบุ status หรือ assigned_to'; s.push('updated_at=NOW()'); v.push(i.lead_id); const old=await query(tid,`SELECT status,assigned_to FROM leads WHERE id=$1 AND tenant_id='${tid}'`,[i.lead_id]); const r=await query(tid,`UPDATE leads SET ${s.join(',')} WHERE id=$${x} AND tenant_id='${tid}' RETURNING id,name,status,assigned_to`,v); if(r.rows[0]&&old.rows[0]){ if(i.status&&i.status!==old.rows[0].status){await query(tid,`INSERT INTO lead_histories(lead_id,field_name,old_value,new_value) VALUES($1,'status',$2,$3)`,[i.lead_id,old.rows[0].status,i.status]);} if(i.assigned_to&&i.assigned_to!==old.rows[0].assigned_to){await query(tid,`INSERT INTO lead_histories(lead_id,field_name,old_value,new_value) VALUES($1,'assigned_to',$2,$3)`,[i.lead_id,old.rows[0].assigned_to,i.assigned_to]);} } return r.rows[0]?`✅ อัพเดท Lead สำเร็จ: ${JSON.stringify(r.rows[0])}`:'❌ ไม่พบ Lead'; } },

  { name: 'create_task', description: 'สร้าง Task ใหม่ — ต้องมี title, due_date, assigned_to', inputSchema: { json: { type: 'object', properties: { title: { type: 'string', description: 'ชื่องาน (required)' }, due_date: { type: 'string', description: 'วันครบกำหนด YYYY-MM-DD (required)' }, assigned_to: { type: 'string', description: 'User ID ที่รับผิดชอบ (required)' }, priority: { type: 'string', description: 'High,Medium,Low (default: Medium)' }, description: { type: 'string' } }, required: ['title','due_date','assigned_to'] } },
    handler: async (i, tid) => { const r=await query(tid,`INSERT INTO tasks(tenant_id,title,description,due_date,priority,status,assigned_to) VALUES($1,$2,$3,$4,$5,'Open',$6) RETURNING id,title,status,due_date,priority`,[tid,i.title,i.description||null,i.due_date,i.priority||'Medium',i.assigned_to]); return `✅ สร้าง Task สำเร็จ: ${JSON.stringify(r.rows[0])}`; } },
];

// ══════════════════════════════════════════════════════════════
// System Prompt — Conversational + Action-oriented
// ══════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `คุณคือ "น้องขายไว" Sales Personal Assistant ตอบภาษาไทยสุภาพ ใช้ค่ะ

กฎการตอบ:
- ตอบเป็นประโยคธรรมชาติเหมือนคนพูดคุยกัน เว้นบรรทัดแบ่งย่อหน้าให้อ่านง่าย
- ห้ามใช้ emoji เด็ดขาด
- ห้ามใช้ heading markdown (##, ###) เด็ดขาด
- ห้ามใช้ตาราง markdown (| --- |) เด็ดขาด
- ห้ามใช้ bold (**text**) เด็ดขาด
- ห้ามใช้ bullet points ที่ขึ้นต้นด้วย - หรือ * ให้เขียนเป็นประโยคต่อเนื่องแทน
- ตอบสั้นกระชับ ไม่เกิน 6-8 บรรทัด
- ห้ามแสดง UUID/ID แปลงเป็นชื่อเสมอ

หลักการทำงาน:
- ใช้ tools ดึงข้อมูลจริงเสมอ ห้ามเดา
- ทำ action ได้เลย เช่น สร้าง Lead, สร้าง Task, Assign Lead
- ถ้าข้อมูลไม่ครบ ให้ถามกลับ
- จบด้วยคำแนะนำ next action เมื่อเหมาะสม

ตัวอย่างการตอบที่ดี:
"ตอนนี้มี Lead ที่ยังไม่ได้ assign 2 คนค่ะ คือคุณ Nartbodee จาก Intervision กับคุณวิชัย จากกรุงเทพซอฟต์ มูลค่าประมาณ 87,500 บาท

อยากให้ assign ให้ใครดีคะ ตอนนี้คุณสมชายกับคุณศิริพร workload น้อยสุดค่ะ"`;

// ══════════════════════════════════════════════════════════════
// System Prompts per Agent Type (for Bedrock Converse fallback)
// ══════════════════════════════════════════════════════════════

const ANALYTICS_SYSTEM_PROMPT = `คุณคือ "น้องวิ" นักวิเคราะห์ข้อมูลการขาย ตอบภาษาไทยสุภาพ ใช้ค่ะ

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

วิธีตอบ:
- เริ่มด้วยสรุปภาพรวม 1-2 ประโยค
- ตามด้วยรายละเอียดตัวเลขสำคัญเป็นย่อหน้าสั้นๆ
- จบด้วยคำแนะนำ 1-2 ข้อ

ตัวอย่างการตอบที่ดี:
"ภาพรวม KPI เดือนนี้ค่ะ Win Rate อยู่ที่ 14.4% จาก Lead ทั้งหมด 215 ราย ปิดได้ 31 ราย

ลูกค้า Active มี 89 ราย Pipeline มูลค่ารวม 177 ล้านบาท โดย Proposal stage สูงสุดที่ 110 ล้าน ส่วน Task เกินกำหนดมี 23 งาน ซึ่งอาจกระทบการ follow-up ค่ะ

แนะนำให้โฟกัส Deal ใน Proposal stage ก่อนค่ะ เพราะมูลค่าสูงและใกล้ปิดที่สุด"`;

const ADMIN_SYSTEM_PROMPT = `คุณคือ "น้องแอ๊ด" — AI Sales Assistant ต้อนรับลูกค้า

## บุคลิก
- พูดภาษาไทยสุภาพ ใช้ค่ะ/นะคะ เป็นมิตร อบอุ่น
- ถามเชิงรุกทีละอย่าง ไม่ถามพร้อมกันทั้งหมด
- **ห้ามแสดง UUID, ID, หรือ technical data ให้ผู้ใช้เด็ดขาด**

## หน้าที่หลัก
1. ต้อนรับลูกค้า ทำความเข้าใจความต้องการ
2. แนะนำสินค้า/บริการ (ใช้ get_products)
3. เก็บข้อมูล Lead แล้วใช้ create_lead สร้างในระบบ

## สินค้าหลัก
- Cloud Solutions: AWS Migration (เริ่ม ฿150K), Managed Cloud (฿25K/เดือน)
- Software Development: Web App (เริ่ม ฿300K), Mobile App (เริ่ม ฿500K)
- IT Consulting: Digital Transformation (฿80K), Security Audit (฿120K)
- Support Plans: Basic (฿5K/เดือน), Premium (฿15K/เดือน), Enterprise (฿35K/เดือน)

## กฎสำคัญ
- ห้ามให้ส่วนลดหรือสัญญาราคาตายตัว
- ถ้าตอบไม่ได้ บอกว่าจะให้ผู้เชี่ยวชาญติดต่อกลับ`;

function getSystemPromptForAgent(agentType: string): string {
  if (agentType === 'analytics') return ANALYTICS_SYSTEM_PROMPT;
  if (agentType === 'admin-ai' || agentType === 'admin') return ADMIN_SYSTEM_PROMPT;
  return SYSTEM_PROMPT;
}

function getAgentDisplayName(agentType: string): string {
  if (agentType === 'analytics') return 'น้องวิ';
  if (agentType === 'admin-ai' || agentType === 'admin') return 'น้องแอ๊ด';
  return 'น้องขายไว';
}

async function runAgent(message: string, agentType: string, tenantId: string, history?: any[]): Promise<{ reply: string; toolsUsed: string[] }> {
  const start = Date.now();
  const toolsUsed: string[] = [];
  const toolConfig = { tools: TOOLS.map(t => ({ toolSpec: { name: t.name, description: t.description, inputSchema: t.inputSchema } })) };

  // Load AI config from DynamoDB (cached 60s)
  const aiConfig = await getAIConfig(tenantId);

  // Use correct system prompt for agent type
  const systemPrompt = getSystemPromptForAgent(agentType);

  // Build messages with conversation history
  const messages: any[] = [];
  if (history && history.length > 0) {
    for (const h of history.slice(-6)) { // last 6 turns for context
      messages.push({ role: h.role, content: [{ text: h.content }] });
    }
  }
  messages.push({ role: 'user', content: [{ text: message }] });

  let finalReply = '';

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const overBudget = (Date.now() - start) > TIME_BUDGET_MS;

    let resOutput: any;

    // Use Bedrock SDK with Lambda IAM Role (same account, via VPC Endpoint)
    const client = new BedrockRuntimeClient({ region: aiConfig.region });
    const res = await client.send(new ConverseCommand({
      modelId: aiConfig.modelId,
      system: [{ text: systemPrompt + `\n\n[Context: tenantId=${tenantId}]` + (overBudget ? '\n\n[URGENT: ตอบทันทีไม่ต้องเรียก tool เพิ่ม]' : '') }],
      messages,
      toolConfig,
      inferenceConfig: { maxTokens: aiConfig.maxTokens, temperature: aiConfig.temperature },
    }));
    resOutput = { message: res.output?.message, stopReason: res.stopReason };

    const content = (resOutput?.message?.content || []).filter((c: any) => {
      if ('text' in c && (!c.text || !c.text.trim())) return false;
      return true;
    });
    if (content.length === 0) content.push({ text: ' ' });
    messages.push({ role: 'assistant', content });

    const stopReason = resOutput?.stopReason || '';
    const toolUses = content.filter((c: any) => c.toolUse);
    if (toolUses.length === 0 || stopReason !== 'tool_use' || overBudget) {
      finalReply = content.map((c: any) => c.text || '').join('').trim();
      break;
    }

    // Execute tools
    const toolResults: any[] = [];
    for (const block of toolUses) {
      const { toolUseId, name, input } = block.toolUse;
      const toolDef = TOOLS.find(t => t.name === name);
      toolsUsed.push(name);
      if (!toolDef) {
        toolResults.push({ toolResult: { toolUseId, content: [{ text: `Tool ${name} not found` }], status: 'error' } });
        continue;
      }
      try {
        const result = await toolDef.handler(input, tenantId);
        toolResults.push({ toolResult: { toolUseId, content: [{ text: result.substring(0, 8000) }] } });
      } catch (err: any) {
        toolResults.push({ toolResult: { toolUseId, content: [{ text: `Error: ${err.message}` }], status: 'error' } });
      }
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return { reply: finalReply || 'ขออภัยค่ะ ไม่สามารถตอบได้ในขณะนี้', toolsUsed };
}

// ══════════════════════════════════════════════════════════════
// Event Handler (SQS domain events)
// ══════════════════════════════════════════════════════════════

export async function handleAgentEvent(event: { eventType: string; tenantId: string; entityId: string; data: any }) {
  const tid = event.tenantId || '00000000-0000-0000-0000-000000000001';

  if (event.eventType === 'lead.created') {
    const d = event.data || {};
    const title = '🔔 Lead ใหม่จาก LINE';
    const body = `${d.name || 'ไม่ระบุชื่อ'}${d.company ? ' (' + d.company + ')' : ''} สนใจ ${d.product || '-'} งบ ${d.budget || '-'}`;
    try {
      const managers = await query(tid, `SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE u.tenant_id = $1 AND u.is_active = true AND r.name IN ('Admin', 'Sales Manager')`, [tid]);
      for (const mgr of managers.rows) {
        await query(tid, `INSERT INTO notifications (tenant_id, user_id, channel, type, title, body, metadata, status) VALUES ($1, $2, 'in_app', 'lead_new', $3, $4, $5, 'pending')`, [tid, mgr.id, title, body, JSON.stringify({ leadId: event.entityId, source: d.source || 'line', ...d })]);
      }
      console.log(`[Event] lead.created: notified ${managers.rows.length} managers`);
    } catch (err: any) { console.error('[Event] Notification failed:', err.message); }
  }

  if (event.eventType === 'task.overdue') {
    try {
      const d = event.data || {};
      await query(tid, `INSERT INTO notifications (tenant_id, user_id, channel, type, title, body, metadata, status) VALUES ($1, $2, 'in_app', 'task_overdue', $3, $4, $5, 'pending')`, [tid, d.assignedTo || '', '⚠️ Task เกินกำหนด', d.title || '', JSON.stringify(d)]);
    } catch {}
  }
}


// ══════════════════════════════════════════════════════════════
// Routes
// ══════════════════════════════════════════════════════════════

agents.post('/chat', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { message, agentType, tenantId, sessionId, conversationHistory } = body as any;
  if (!message) return c.json({ error: 'message required' }, 400);

  const tid = (!tenantId || tenantId === 'default') ? '00000000-0000-0000-0000-000000000001' : tenantId;
  const agent = (agentType && agentType !== 'sales-assistant') ? agentType : detectAgentType(message);
  const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await taskDdb.send(new PutItem2({
    TableName: TASK_TABLE,
    Item: { PK: { S: `TASK#${taskId}` }, SK: { S: 'STATUS' }, status: { S: 'processing' }, message: { S: message }, agentType: { S: agent }, tenantId: { S: tid }, createdAt: { S: new Date().toISOString() } },
  }));

  // Fargate: run agent in background (no Lambda self-invoke needed)
  (async () => {
    try {
      let reply = '';
      if (USE_AGENTCORE) {
        const result = await invokeAgentCore(message, agent, tid, sessionId);
        reply = result.reply;
      } else {
        const out = await runAgent(message, agent, tid);
        reply = out.reply;
      }
      await taskDdb.send(new PutItem2({
        TableName: TASK_TABLE,
        Item: { PK: { S: `TASK#${taskId}` }, SK: { S: 'STATUS' }, status: { S: 'done' }, reply: { S: reply }, agentUsed: { S: getAgentDisplayName(agent) }, completedAt: { S: new Date().toISOString() } },
      }));
    } catch (err: any) {
      console.error('[AgentTask]', err.message);
      await taskDdb.send(new PutItem2({
        TableName: TASK_TABLE,
        Item: { PK: { S: `TASK#${taskId}` }, SK: { S: 'STATUS' }, status: { S: 'error' }, reply: { S: 'ขออภัยค่ะ: ' + String(err.message || '').slice(0, 200) }, completedAt: { S: new Date().toISOString() } },
      }));
    }
  })();

  return c.json({ reply: null, taskId, status: 'processing', message: 'กำลังประมวลผลค่ะ รอสักครู่...', agentUsed: getAgentDisplayName(agent), backend: 'fargate-strands' });
});

agents.post('/stream', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { message, agentType, tenantId, conversationHistory } = body as any;
  if (!message) return c.json({ message: 'message required' }, 400);
  const agent = agentType || 'sales-assistant';
  try {
    const out = await runAgent(message, agent, (!tenantId || tenantId === 'default') ? '00000000-0000-0000-0000-000000000001' : tenantId, conversationHistory);
    return new Response(
      `data: ${JSON.stringify({ type: 'text', content: out.reply, toolsUsed: out.toolsUsed, agentUsed: getAgentDisplayName(agent) })}\n\ndata: [DONE]\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (err: any) {
    return new Response(`data: ${JSON.stringify({ type: 'text', content: 'ขออภัยค่ะ: ' + String(err.message).slice(0, 100) })}\n\ndata: [DONE]\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*' } });
  }
});

agents.get('/health', (c) => c.json({ ok: true, service: 'agents', backend: USE_AGENTCORE ? 'agentcore+fallback' : 'bedrock-converse', tools: TOOLS.length, agents: ['admin','sales-assistant','analytics'], ts: Date.now() }));

// ══════════════════════════════════════════════════════════════
// Auto-detect agent type from message (mirrors AgentCore factory logic)
// ══════════════════════════════════════════════════════════════

function detectAgentType(message: string): string {
  const lower = message.toLowerCase();
  const analyticsKeywords = [
    'forecast', 'พยากรณ์', 'churn', 'เสี่ยงหาย', 'win rate', 'conversion',
    'เปรียบเทียบ', 'performance', 'ผลงาน', 'revenue', 'trend',
    'kpi', 'สรุปยอด', 'วิเคราะห์', 'avg deal', 'pipeline',
  ];
  const adminKeywords = [
    'สนใจสินค้า', 'ขอใบเสนอราคา', 'ติดต่อกลับ', 'สอบถามราคา',
    'บริการอะไร', 'ราคาเท่าไหร่', 'แพ็คเกจ',
  ];
  if (analyticsKeywords.some(k => lower.includes(k))) return 'analytics';
  if (adminKeywords.some(k => lower.includes(k))) return 'admin';
  return 'sales-assistant';
}

// ══════════════════════════════════════════════════════════════
// Async Task Pattern — for long-running agent actions
// ══════════════════════════════════════════════════════════════

import { DynamoDBClient as DDBClient2, PutItemCommand as PutItem2, GetItemCommand as GetItem2 } from '@aws-sdk/client-dynamodb';
const taskDdb = new DDBClient2({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const TASK_TABLE = process.env.AI_STATE_TABLE || 'sf7-prod-ai-state';

// POST /agents/task — Start async agent task (returns immediately)
agents.post('/task', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { message, agentType, tenantId, sessionId } = body as any;
  if (!message) return c.json({ error: 'message required' }, 400);

  const tid = (!tenantId || tenantId === 'default') ? '00000000-0000-0000-0000-000000000001' : tenantId;
  const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Save task as "processing"
  await taskDdb.send(new PutItem2({
    TableName: TASK_TABLE,
    Item: {
      PK: { S: `TASK#${taskId}` },
      SK: { S: 'STATUS' },
      status: { S: 'processing' },
      message: { S: message },
      agentType: { S: agentType || 'sales-assistant' },
      tenantId: { S: tid },
      createdAt: { S: new Date().toISOString() },
    },
  }));

  // Run agent in background (don't await — let it finish after response)
  const agent = agentType || 'sales-assistant';
  (async () => {
    try {
      let reply = '';
      if (USE_AGENTCORE) {
        const result = await invokeAgentCore(message, agent, tid, sessionId);
        reply = result.reply;
      } else {
        const out = await runAgent(message, agent, tid);
        reply = out.reply;
      }
      await taskDdb.send(new PutItem2({
        TableName: TASK_TABLE,
        Item: {
          PK: { S: `TASK#${taskId}` },
          SK: { S: 'STATUS' },
          status: { S: 'done' },
          reply: { S: reply },
          completedAt: { S: new Date().toISOString() },
        },
      }));
    } catch (err: any) {
      await taskDdb.send(new PutItem2({
        TableName: TASK_TABLE,
        Item: {
          PK: { S: `TASK#${taskId}` },
          SK: { S: 'STATUS' },
          status: { S: 'error' },
          reply: { S: 'ขออภัยค่ะ: ' + String(err.message || '').slice(0, 200) },
          completedAt: { S: new Date().toISOString() },
        },
      }));
    }
  })();

  return c.json({ taskId, status: 'processing', message: 'กำลังดำเนินการค่ะ...' });
});

// GET /agents/task/:id — Poll task status
agents.get('/task/:id', async (c) => {
  const taskId = c.req.param('id');
  const res = await taskDdb.send(new GetItem2({
    TableName: TASK_TABLE,
    Key: { PK: { S: `TASK#${taskId}` }, SK: { S: 'STATUS' } },
  }));
  if (!res.Item) return c.json({ status: 'not_found' }, 404);
  return c.json({
    taskId,
    status: res.Item.status?.S || 'unknown',
    reply: res.Item.reply?.S || null,
    completedAt: res.Item.completedAt?.S || null,
  });
});

export async function runAgentTask(message: string, agentType: string, tenantId: string, sessionId?: string): Promise<string> {
  const { DynamoDBClient, GetItemCommand, PutItemCommand } = await import('@aws-sdk/client-dynamodb');
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
  const table = process.env.AI_STATE_TABLE || 'sf7-prod-ai-state';
  const sid = sessionId || 'default';

  // Load conversation history
  let history: any[] = [];
  try {
    const res = await ddb.send(new GetItemCommand({ TableName: table, Key: { PK: { S: `CHAT#${sid}` }, SK: { S: 'HISTORY' } } }));
    if (res.Item?.data?.S) {
      history = JSON.parse(res.Item.data.S);
      if (history.length > 12) history = history.slice(-12); // keep last 6 turns
    }
  } catch {}

  // Run agent with history
  const out = await runAgent(message, agentType, tenantId, history);

  // Save updated history
  try {
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: out.reply });
    if (history.length > 12) history = history.slice(-12);
    await ddb.send(new PutItemCommand({
      TableName: table,
      Item: { PK: { S: `CHAT#${sid}` }, SK: { S: 'HISTORY' }, data: { S: JSON.stringify(history) }, ttl: { N: String(Math.floor(Date.now()/1000) + 3600) } },
    }));
  } catch {}

  return out.reply;
}

export default agents;
