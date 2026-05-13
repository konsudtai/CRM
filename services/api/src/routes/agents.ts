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
const AGENTCORE_REGION = process.env.AGENTCORE_REGION || process.env.BEDROCK_REGION || 'ap-southeast-1';
const DEFAULT_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'apac.anthropic.claude-sonnet-4-20250514-v1:0';
const DEFAULT_REGION = process.env.BEDROCK_REGION || 'ap-southeast-1';
const USE_AGENTCORE = process.env.USE_AGENTCORE !== 'false' && !!AGENTCORE_ARN;
const MAX_ITERATIONS = 8;
const TIME_BUDGET_MS = 25000;
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
  const timeoutId = setTimeout(() => abortController.abort(), 20000);
  let response: any;
  try {
    response = await client.send(new InvokeAgentRuntimeCommand({
      agentRuntimeArn: AGENTCORE_ARN, runtimeSessionId: sid,
      payload: new TextEncoder().encode(payload), qualifier: 'DEFAULT',
    }), { abortSignal: abortController.signal });
  } finally { clearTimeout(timeoutId); }

  // Debug removed — production
  console.log('[AgentCore] statusCode:', response.statusCode);

  // Handle response — may be various formats from AgentCore SDK
  let responseBody = '';
  try {
    const r = response.response;
    if (!r) {
      responseBody = '';
    } else if (typeof r === 'string') {
      responseBody = r;
    } else if (typeof r.transformToString === 'function') {
      responseBody = await r.transformToString();
    } else if (typeof r.read === 'function') {
      // Node.js Readable stream
      const chunks: Buffer[] = [];
      for await (const chunk of r) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      responseBody = Buffer.concat(chunks).toString('utf-8');
    } else if (typeof r[Symbol.asyncIterator] === 'function') {
      const chunks: Uint8Array[] = [];
      for await (const chunk of r) {
        chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
      }
      responseBody = new TextDecoder().decode(Buffer.concat(chunks));
    } else if (r instanceof Uint8Array || Buffer.isBuffer(r)) {
      responseBody = new TextDecoder().decode(r);
    } else if (r.body) {
      const chunks: Uint8Array[] = [];
      for await (const chunk of r.body) {
        if (chunk instanceof Uint8Array) chunks.push(chunk);
        else if (chunk.chunk?.bytes) chunks.push(new Uint8Array(chunk.chunk.bytes));
      }
      if (chunks.length > 0) responseBody = new TextDecoder().decode(Buffer.concat(chunks));
    } else {
      // Last resort — try to stringify
      try { responseBody = JSON.stringify(r); } catch { responseBody = ''; }
    }
  } catch (parseErr: any) {
    console.warn('[AgentCore] parse error:', parseErr.message);
    responseBody = '';
  }

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
    handler: async (i, tid) => { const s:string[]=[],v:any[]=[]; let x=1; if(i.status){s.push(`status=$${x}`);v.push(i.status);x++;} if(i.assigned_to){s.push(`assigned_to=$${x}`);v.push(i.assigned_to);x++;} if(!s.length) return 'ไม่มีข้อมูลที่จะอัพเดท กรุณาระบุ status หรือ assigned_to'; s.push('updated_at=NOW()'); v.push(i.lead_id); const r=await query(tid,`UPDATE leads SET ${s.join(',')} WHERE id=$${x} AND tenant_id='${tid}' RETURNING id,name,status,assigned_to`,v); return r.rows[0]?`✅ อัพเดท Lead สำเร็จ: ${JSON.stringify(r.rows[0])}`:'❌ ไม่พบ Lead'; } },

  { name: 'create_task', description: 'สร้าง Task ใหม่ — ต้องมี title, due_date, assigned_to', inputSchema: { json: { type: 'object', properties: { title: { type: 'string', description: 'ชื่องาน (required)' }, due_date: { type: 'string', description: 'วันครบกำหนด YYYY-MM-DD (required)' }, assigned_to: { type: 'string', description: 'User ID ที่รับผิดชอบ (required)' }, priority: { type: 'string', description: 'High,Medium,Low (default: Medium)' }, description: { type: 'string' } }, required: ['title','due_date','assigned_to'] } },
    handler: async (i, tid) => { const r=await query(tid,`INSERT INTO tasks(tenant_id,title,description,due_date,priority,status,assigned_to) VALUES($1,$2,$3,$4,$5,'Open',$6) RETURNING id,title,status,due_date,priority`,[tid,i.title,i.description||null,i.due_date,i.priority||'Medium',i.assigned_to]); return `✅ สร้าง Task สำเร็จ: ${JSON.stringify(r.rows[0])}`; } },
];

// ══════════════════════════════════════════════════════════════
// System Prompt — Conversational + Action-oriented
// ══════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `คุณคือ "น้องขายไว" — Sales Personal Assistant ที่ทำงานจริงได้

## บุคลิก
- พูดภาษาไทย สุภาพ ใช้ค่ะ เป็นกันเอง
- ตอบสั้น กระชับ ใช้ bullet points
- ใช้ emoji เล็กน้อย (✅ 📊 📈 ⚠️ 💡)
- **ห้ามแสดง UUID, ID, หรือ technical data ให้ผู้ใช้เด็ดขาด** — แปลงเป็นชื่อ/ข้อมูลที่อ่านง่ายเสมอ

## หลักการทำงาน
1. **ใช้ tools ดึงข้อมูลจริงเสมอ** — ห้ามเดาหรือสมมติ
2. **ทำ action จริงได้** — สร้าง Lead, สร้าง Task, อัพเดท status
3. **ถ้าข้อมูลไม่ครบ ให้ถามกลับ** — อย่าเดาข้อมูลที่ขาด
4. **คิดก่อนตอบ** — วิเคราะห์ข้อมูลที่ได้จาก tools แล้วสรุปเป็นภาษาคนที่เข้าใจง่าย

## การแสดงผลข้อมูล
- ห้ามแสดง UUID หรือ database ID (เช่น "abc-123-def") ให้ผู้ใช้
- แสดงชื่อ, ตัวเลข, สถานะ แทน ID เสมอ
- ถ้ามีหลายรายการ → สรุปเป็นตาราง/bullet ที่อ่านง่าย
- ใส่ context เช่น "จากทั้งหมด X รายการ" หรือ "เทียบกับเดือนที่แล้ว"
- ตอบแบบ insight ไม่ใช่แค่ dump ข้อมูล

## การสร้าง Lead
- ต้องมีอย่างน้อย: ชื่อ + (เบอร์โทร หรือ email)
- ถ้าผู้ใช้บอกแค่ชื่อ → ถามเบอร์โทรหรือ email ก่อนสร้าง
- ถ้าได้ข้อมูลครบ → ใช้ create_lead สร้างทันที
- หลังสร้าง → สรุปให้ผู้ใช้ทราบ + แนะนำ next action

## การสร้าง Task
- ต้องมี: title + due_date + assigned_to
- ถ้าไม่รู้ assigned_to → ใช้ get_users ดูรายชื่อก่อน แล้วถามผู้ใช้
- ถ้าไม่รู้ due_date → ถามว่าต้องการให้เสร็จเมื่อไหร่

## การอัพเดท Lead
- ต้องรู้ lead_id → ถ้าไม่รู้ ให้ get_leads ค้นหาก่อน
- ยืนยันกับผู้ใช้ก่อนเปลี่ยน status สำคัญ (Won/Lost)

## วิธีตอบ
- ดึงข้อมูลจาก tools ก่อนตอบเสมอ
- ถ้าถูกถามข้อมูล → ดึงจาก DB แล้วสรุปให้เป็นภาษาคน พร้อม insight
- ถ้าถูกสั่งให้ทำ → ตรวจสอบข้อมูลครบไหม → ถ้าครบทำเลย → ถ้าไม่ครบถามก่อน
- จบด้วยคำแนะนำ next action เมื่อเหมาะสม
- ตอบเหมือนเพื่อนร่วมงานที่เก่ง ไม่ใช่ robot`;

// ══════════════════════════════════════════════════════════════
// Agent Runner (Bedrock Converse + tool_use loop)
// ══════════════════════════════════════════════════════════════

async function runAgent(message: string, agentType: string, tenantId: string, history?: any[]): Promise<{ reply: string; toolsUsed: string[] }> {
  const start = Date.now();
  const toolsUsed: string[] = [];
  const toolConfig = { tools: TOOLS.map(t => ({ toolSpec: { name: t.name, description: t.description, inputSchema: t.inputSchema } })) };

  // Load AI config from DynamoDB (cached 60s)
  const aiConfig = await getAIConfig(tenantId);

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
      system: [{ text: SYSTEM_PROMPT + `\n\n[Context: tenantId=${tenantId}]` + (overBudget ? '\n\n[URGENT: ตอบทันทีไม่ต้องเรียก tool เพิ่ม]' : '') }],
      messages,
      toolConfig: !overBudget ? toolConfig : undefined,
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
  const prompts: Record<string, string> = {
    'lead.created': `[SYSTEM] Lead ใหม่เข้ามา ID=${event.entityId} ข้อมูล: ${JSON.stringify(event.data).slice(0,500)}\nกรุณา: 1) ดูรายละเอียด Lead 2) สรุปให้ Manager`,
    'task.overdue': `[SYSTEM] Task เกินกำหนด ID=${event.entityId} ข้อมูล: ${JSON.stringify(event.data).slice(0,300)}`,
    'lead.assigned': `[SYSTEM] Lead ถูก assign แล้ว ID=${event.entityId} ให้: ${event.data?.assignedTo}`,
  };
  const prompt = prompts[event.eventType];
  if (!prompt) return;
  await runAgent(prompt, 'sales-assistant', event.tenantId);
}

// ══════════════════════════════════════════════════════════════
// Routes
// ══════════════════════════════════════════════════════════════

agents.post('/chat', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { message, agentType, tenantId, sessionId, conversationHistory } = body as any;
  if (!message) return c.json({ error: 'message required' }, 400);

  const tid = (!tenantId || tenantId === 'default') ? '00000000-0000-0000-0000-000000000001' : tenantId;
  const agent = agentType || 'sales-assistant';

  // Try AgentCore first (if warm)
  if (USE_AGENTCORE) {
    try {
      const result = await invokeAgentCore(message, agent, tid, sessionId);
      return c.json({ reply: result.reply, agentUsed: result.agentUsed, sessionId: result.sessionId, backend: 'agentcore' });
    } catch (acErr: any) {
      // AgentCore failed — return error immediately (no Bedrock fallback in VPC)
      return c.json({ reply: 'ขออภัยค่ะ AgentCore ไม่ตอบสนอง กรุณาลองใหม่อีกครั้งค่ะ (' + String(acErr.message || '').slice(0, 80) + ')', error: true, backend: 'agentcore-failed' }, 200);
    }
  }

  // Bedrock Converse fallback (only when AgentCore is disabled)
  try {
    const out = await runAgent(message, agent, tid, conversationHistory);
    return c.json({ reply: out.reply, toolsUsed: out.toolsUsed, backend: 'bedrock-converse', agentUsed: 'น้องขายไว' });
  } catch (err: any) {
    return c.json({ reply: 'ขออภัยค่ะ เกิดข้อผิดพลาด: ' + String(err.message).slice(0, 150), error: true }, 200);
  }
});

agents.post('/stream', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { message, agentType, tenantId, conversationHistory } = body as any;
  if (!message) return c.json({ message: 'message required' }, 400);
  try {
    const out = await runAgent(message, agentType || 'sales-assistant', (!tenantId || tenantId === 'default') ? '00000000-0000-0000-0000-000000000001' : tenantId, conversationHistory);
    return new Response(
      `data: ${JSON.stringify({ type: 'text', content: out.reply, toolsUsed: out.toolsUsed })}\n\ndata: [DONE]\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (err: any) {
    return new Response(`data: ${JSON.stringify({ type: 'text', content: 'ขออภัยค่ะ: ' + String(err.message).slice(0, 100) })}\n\ndata: [DONE]\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*' } });
  }
});

agents.get('/health', (c) => c.json({ ok: true, service: 'agents', backend: USE_AGENTCORE ? 'agentcore+fallback' : 'bedrock-converse', tools: TOOLS.length, agents: ['admin','sales-assistant','analytics'], ts: Date.now() }));

export default agents;
