/**
 * SalesFAST 7 — WebSocket + Strands-style Streaming Agent
 * 
 * Features:
 * - Bedrock ConverseStream for real-time text streaming
 * - Tool progress updates (กำลังค้นหา Lead...)
 * - 3 Agents with A2A (all in same Lambda)
 * - Claude Sonnet 4.6
 */
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { BedrockRuntimeClient, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, PutItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { query } from './lib/db.js';

const TABLE = process.env.WS_CONNECTIONS_TABLE || 'sf7-prod-ws-connections';
const WS_ENDPOINT = process.env.WS_API_ENDPOINT || 'https://hfk8agbl8f.execute-api.ap-southeast-1.amazonaws.com/prod';
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-4-6';
const REGION = process.env.BEDROCK_REGION || 'ap-southeast-1';
const MAX_ITERATIONS = 6;

const ddb = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const bedrock = new BedrockRuntimeClient({ region: REGION });

// ══════════════════════════════════════════════════════════════
// WebSocket helpers
// ══════════════════════════════════════════════════════════════

async function send(endpoint: string, connId: string, data: any) {
  const client = new ApiGatewayManagementApiClient({ endpoint });
  try {
    await client.send(new PostToConnectionCommand({
      ConnectionId: connId,
      Data: new TextEncoder().encode(JSON.stringify(data)),
    }));
  } catch (err: any) {
    if (err.statusCode === 410) {
      await ddb.send(new DeleteItemCommand({ TableName: TABLE, Key: { connectionId: { S: connId } } }));
    }
  }
}

// ══════════════════════════════════════════════════════════════
// Agent routing
// ══════════════════════════════════════════════════════════════

function detectAgent(msg: string): string {
  const l = msg.toLowerCase();
  if (['forecast','พยากรณ์','churn','win rate','conversion','เปรียบเทียบ','performance','ผลงาน','revenue','kpi','วิเคราะห์','pipeline','สรุปยอด'].some(k => l.includes(k))) return 'analytics';
  if (['สนใจสินค้า','ขอใบเสนอราคา','สอบถามราคา','บริการอะไร','ราคาเท่าไหร่'].some(k => l.includes(k))) return 'admin';
  return 'sales';
}

function agentName(t: string): string {
  if (t === 'analytics') return 'น้องวิ';
  if (t === 'admin') return 'น้องแอ๊ด';
  return 'น้องขายไว';
}

// ══════════════════════════════════════════════════════════════
// System Prompts
// ══════════════════════════════════════════════════════════════

const PROMPTS: Record<string, string> = {
  sales: `คุณคือ "น้องขายไว" Sales Personal Assistant ตอบภาษาไทยสุภาพ ใช้ค่ะ

กฎสำคัญ:
- ตอบเป็นประโยคธรรมชาติเหมือนคนพูด ห้ามใช้ตาราง markdown (| --- |) เด็ดขาด
- ใช้ bullet points เมื่อต้องแสดงรายการ
- ตอบสั้นกระชับ 3-5 บรรทัด
- ห้ามแสดง UUID/ID ให้ผู้ใช้ แปลงเป็นชื่อเสมอ
- ใช้ emoji น้อยๆ (✅ ⚠️ 📊)
- ทำ action ได้เลย: assign lead, สร้าง QT, อนุมัติ, สร้าง task
- ใช้ tools ดึงข้อมูลจริงเสมอ ห้ามเดา`,

  analytics: `คุณคือ "น้องวิ" AI Analytics Specialist ตอบภาษาไทยสุภาพ ใช้ค่ะ

กฎสำคัญ:
- ตอบเป็นประโยคธรรมชาติ ห้ามใช้ตาราง markdown เด็ดขาด
- สรุปตัวเลขเป็นประโยค เช่น "pipeline มีมูลค่ารวม 177 ล้านบาท"
- ใช้ bullet points แทนตาราง
- ใช้ตัวเลขจริงจาก tools เสมอ ห้ามสมมติ
- ใช้ emoji น้อยๆ (📈 ⚠️ ✅)
- จบด้วยคำแนะนำ 1-3 ข้อ`,

  admin: `คุณคือ "น้องแอ๊ด" ผู้ช่วยต้อนรับลูกค้า ตอบภาษาไทยสุภาพ ใช้ค่ะ

กฎสำคัญ:
- ตอบเป็นประโยคธรรมชาติ อบอุ่น เป็นมิตร
- ตอบสั้น 3-4 บรรทัด ถามทีละอย่าง
- เมื่อได้ข้อมูลครบ(ชื่อ+เบอร์+สนใจอะไร) สร้าง Lead ทันที
- ห้ามให้ส่วนลดหรือสัญญาราคาตายตัว
- แนะนำสินค้า: Cloud Solutions (เริ่ม 150K), Web App (300K), Mobile (500K)`,
};

// ══════════════════════════════════════════════════════════════
// CRM Tools
// ══════════════════════════════════════════════════════════════

interface ToolDef {
  name: string;
  description: string;
  inputSchema: any;
  handler: (input: any, tid: string) => Promise<string>;
  displayName: string; // Thai name for progress display
}

const TOOLS: ToolDef[] = [
  { name: 'get_leads', displayName: 'ค้นหา Lead', description: 'ค้นหา Leads ตาม status หรือ keyword', inputSchema: { json: { type: 'object', properties: { status: { type: 'string' }, search: { type: 'string' }, limit: { type: 'number' } } } },
    handler: async (i, tid) => { let w='tenant_id=$1',p:any[]=[tid],x=2; if(i.status){w+=` AND status=$${x}`;p.push(i.status);x++;} if(i.search){w+=` AND (name ILIKE $${x} OR company_name ILIKE $${x})`;p.push(`%${i.search}%`);x++;} p.push(Math.min(i.limit||10,20)); const r=await query(tid,`SELECT id,name,company_name,status,source,assigned_to,(metadata->>'estimatedValue') as value FROM leads WHERE ${w} ORDER BY created_at DESC LIMIT $${x}`,p); return JSON.stringify(r.rows); } },

  { name: 'get_lead_detail', displayName: 'ดูรายละเอียด Lead', description: 'ดูรายละเอียด Lead + Sales Rep', inputSchema: { json: { type: 'object', properties: { lead_id: { type: 'string' }, search: { type: 'string' } } } },
    handler: async (i, tid) => { if(i.lead_id){ const r=await query(tid,`SELECT l.*,u.first_name as rep_first,u.last_name as rep_last,u.email as rep_email FROM leads l LEFT JOIN users u ON u.id=l.assigned_to WHERE l.id=$1 AND l.tenant_id=$2`,[i.lead_id,tid]); return JSON.stringify(r.rows); } if(i.search){ const r=await query(tid,`SELECT l.*,u.first_name as rep_first,u.last_name as rep_last FROM leads l LEFT JOIN users u ON u.id=l.assigned_to WHERE l.tenant_id=$1 AND (l.name ILIKE $2 OR l.company_name ILIKE $2) LIMIT 5`,[tid,`%${i.search}%`]); return JSON.stringify(r.rows); } return '[]'; } },

  { name: 'create_lead', displayName: 'สร้าง Lead', description: 'สร้าง Lead ใหม่', inputSchema: { json: { type: 'object', properties: { name: { type: 'string' }, company_name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, source: { type: 'string' }, notes: { type: 'string' } }, required: ['name'] } },
    handler: async (i, tid) => { const meta:any={}; if(i.notes)meta.notes=i.notes; const r=await query(tid,`INSERT INTO leads(tenant_id,name,company_name,email,phone,source,status,metadata) VALUES($1,$2,$3,$4,$5,$6,'New',$7) RETURNING id,name,status`,[tid,i.name,i.company_name||null,i.email||null,i.phone||null,i.source||'ai_chat',JSON.stringify(meta)]); return `สร้าง Lead สำเร็จ: ${JSON.stringify(r.rows[0])}`; } },

  { name: 'assign_lead', displayName: 'มอบหมาย Lead', description: 'Assign Lead ให้ Sales Rep', inputSchema: { json: { type: 'object', properties: { lead_id: { type: 'string' }, assigned_to: { type: 'string' } }, required: ['lead_id','assigned_to'] } },
    handler: async (i, tid) => { const r=await query(tid,`UPDATE leads SET assigned_to=$1,status='Contacted',updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING id,name,status`,[i.assigned_to,i.lead_id,tid]); return r.rows[0]?`Assign สำเร็จ: ${JSON.stringify(r.rows[0])}`:'ไม่พบ Lead'; } },

  { name: 'get_accounts', displayName: 'ค้นหาลูกค้า', description: 'ค้นหา Accounts', inputSchema: { json: { type: 'object', properties: { search: { type: 'string' }, limit: { type: 'number' } } } },
    handler: async (i, tid) => { let w='tenant_id=$1 AND deleted_at IS NULL',p:any[]=[tid],x=2; if(i.search){w+=` AND (company_name ILIKE $${x} OR phone ILIKE $${x})`;p.push(`%${i.search}%`);x++;} p.push(Math.min(i.limit||10,20)); const r=await query(tid,`SELECT id,company_name,account_status,account_tier,total_revenue FROM accounts WHERE ${w} ORDER BY total_revenue DESC NULLS LAST LIMIT $${x}`,p); return JSON.stringify(r.rows); } },

  { name: 'get_users', displayName: 'ดูรายชื่อทีม', description: 'ดู Sales Reps ทั้งหมด', inputSchema: { json: { type: 'object', properties: {} } },
    handler: async (_i, tid) => { const r=await query(tid,`SELECT u.id,u.first_name||' '||u.last_name as name,u.email,u.phone FROM users u WHERE u.tenant_id=$1 AND u.is_active=true ORDER BY u.first_name`,[tid]); return JSON.stringify(r.rows); } },

  { name: 'get_tasks', displayName: 'ดู Tasks', description: 'ดู Tasks ตาม status/overdue', inputSchema: { json: { type: 'object', properties: { status: { type: 'string' }, assigned_to: { type: 'string' }, overdue_only: { type: 'boolean' } } } },
    handler: async (i, tid) => { let w='tenant_id=$1',p:any[]=[tid],x=2; if(i.status){w+=` AND status=$${x}`;p.push(i.status);x++;} if(i.assigned_to){w+=` AND assigned_to=$${x}`;p.push(i.assigned_to);x++;} if(i.overdue_only) w+=` AND due_date<NOW() AND status!='Completed'`; p.push(10); const r=await query(tid,`SELECT id,title,status,priority,due_date FROM tasks WHERE ${w} ORDER BY due_date ASC LIMIT $${x}`,p); return JSON.stringify(r.rows); } },

  { name: 'create_task', displayName: 'สร้าง Task', description: 'สร้าง Task ใหม่', inputSchema: { json: { type: 'object', properties: { title: { type: 'string' }, due_date: { type: 'string' }, assigned_to: { type: 'string' }, priority: { type: 'string' } }, required: ['title','due_date','assigned_to'] } },
    handler: async (i, tid) => { const r=await query(tid,`INSERT INTO tasks(tenant_id,title,due_date,priority,status,assigned_to) VALUES($1,$2,$3,$4,'Open',$5) RETURNING id,title,status`,[tid,i.title,i.due_date,i.priority||'Medium',i.assigned_to]); return `สร้าง Task สำเร็จ: ${JSON.stringify(r.rows[0])}`; } },

  { name: 'get_products', displayName: 'ค้นหาสินค้า', description: 'ค้นหาสินค้า/บริการ', inputSchema: { json: { type: 'object', properties: { search: { type: 'string' } } } },
    handler: async (i, tid) => { let w='tenant_id=$1 AND is_active=true',p:any[]=[tid],x=2; if(i.search){w+=` AND (name ILIKE $${x} OR sku ILIKE $${x})`;p.push(`%${i.search}%`);x++;} const r=await query(tid,`SELECT id,name,sku,description,unit_price FROM products WHERE ${w} ORDER BY name LIMIT 10`,p); return JSON.stringify(r.rows); } },

  { name: 'get_pipeline_summary', displayName: 'วิเคราะห์ Pipeline', description: 'สรุป Pipeline แต่ละ stage + มูลค่า', inputSchema: { json: { type: 'object', properties: {} } },
    handler: async (_i, tid) => { const r=await query(tid,`SELECT status,count(*) as count,COALESCE(sum((metadata->>'estimatedValue')::numeric),0) as total_value FROM leads WHERE tenant_id=$1 GROUP BY status`,[tid]); return JSON.stringify(r.rows); } },

  { name: 'get_kpi_summary', displayName: 'ดึง KPI', description: 'สรุป KPI ทั้งหมด', inputSchema: { json: { type: 'object', properties: {} } },
    handler: async (_i, tid) => { const [l,a,t,q]=await Promise.all([query(tid,`SELECT count(*) as total,count(*) FILTER(WHERE status='Won') as won FROM leads WHERE tenant_id=$1`,[tid]),query(tid,`SELECT count(*) as total FROM accounts WHERE tenant_id=$1 AND deleted_at IS NULL AND account_status='active'`,[tid]),query(tid,`SELECT count(*) as total,count(*) FILTER(WHERE status!='Completed' AND due_date<NOW()) as overdue FROM tasks WHERE tenant_id=$1`,[tid]),query(tid,`SELECT count(*) as total,COALESCE(sum(grand_total),0) as value FROM quotations WHERE tenant_id=$1`,[tid])]); return JSON.stringify({leads:l.rows[0],activeAccounts:a.rows[0].total,tasks:t.rows[0],quotations:q.rows[0]}); } },

  { name: 'get_sales_performance', displayName: 'ดูผลงานทีม', description: 'ผลงาน Sales Rep แต่ละคน', inputSchema: { json: { type: 'object', properties: {} } },
    handler: async (_i, tid) => { const r=await query(tid,`SELECT u.id,u.first_name||' '||u.last_name as name,(SELECT count(*) FROM leads l WHERE l.assigned_to=u.id) as total_leads,(SELECT count(*) FROM leads l WHERE l.assigned_to=u.id AND l.status='Won') as won_leads FROM users u WHERE u.tenant_id=$1 AND u.is_active=true ORDER BY total_leads DESC`,[tid]); return JSON.stringify(r.rows); } },
];

// Tool config for Bedrock
const TOOL_CONFIG = { tools: TOOLS.map(t => ({ toolSpec: { name: t.name, description: t.description, inputSchema: t.inputSchema } })) };

// ══════════════════════════════════════════════════════════════
// Streaming Agent Runner
// ══════════════════════════════════════════════════════════════

async function runStreamingAgent(
  message: string,
  agentType: string,
  tenantId: string,
  endpoint: string,
  connectionId: string,
) {
  const systemPrompt = PROMPTS[agentType] || PROMPTS.sales;
  const messages: any[] = [{ role: 'user', content: [{ text: message }] }];
  let fullReply = '';

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const res = await bedrock.send(new ConverseStreamCommand({
      modelId: MODEL_ID,
      system: [{ text: systemPrompt + `\n\n[tenantId=${tenantId}]` }],
      messages,
      toolConfig: TOOL_CONFIG,
      inferenceConfig: { maxTokens: 2048, temperature: 0.3 },
    }));

    // Process stream
    let assistantContent: any[] = [];
    let currentText = '';
    let currentToolUse: any = null;
    let streamBuffer = '';

    if (res.stream) {
      for await (const event of res.stream) {
        if (event.contentBlockStart) {
          const start = event.contentBlockStart.start;
          if (start?.toolUse) {
            currentToolUse = { toolUseId: start.toolUse.toolUseId, name: start.toolUse.name, input: '' };
            // Send tool progress to frontend
            const toolDef = TOOLS.find(t => t.name === start.toolUse!.name);
            await send(endpoint, connectionId, { type: 'tool_start', tool: start.toolUse.name, displayName: toolDef?.displayName || start.toolUse.name });
          }
        } else if (event.contentBlockDelta) {
          const delta = event.contentBlockDelta.delta;
          if (delta?.text) {
            currentText += delta.text;
            streamBuffer += delta.text;
            // Send text chunks every ~50 chars for smooth streaming
            if (streamBuffer.length >= 50 || delta.text.includes('\n')) {
              await send(endpoint, connectionId, { type: 'stream', text: streamBuffer });
              streamBuffer = '';
            }
          } else if (delta?.toolUse) {
            if (currentToolUse) currentToolUse.input += delta.toolUse.input || '';
          }
        } else if (event.contentBlockStop) {
          if (currentToolUse) {
            let parsedInput = {};
            try { parsedInput = JSON.parse(currentToolUse.input); } catch {}
            assistantContent.push({ toolUse: { toolUseId: currentToolUse.toolUseId, name: currentToolUse.name, input: parsedInput } });
            currentToolUse = null;
          } else if (currentText) {
            assistantContent.push({ text: currentText });
            // Flush remaining buffer
            if (streamBuffer) {
              await send(endpoint, connectionId, { type: 'stream', text: streamBuffer });
              streamBuffer = '';
            }
            fullReply += currentText;
            currentText = '';
          }
        } else if (event.messageStop) {
          // End of message
          break;
        }
      }
    }

    // Add assistant message to history
    if (assistantContent.length === 0) assistantContent.push({ text: ' ' });
    messages.push({ role: 'assistant', content: assistantContent });

    // Check for tool uses
    const toolUses = assistantContent.filter((c: any) => c.toolUse);
    if (toolUses.length === 0) break; // No tools = final answer

    // Execute tools
    const toolResults: any[] = [];
    for (const block of toolUses) {
      const { toolUseId, name, input } = block.toolUse;
      const toolDef = TOOLS.find(t => t.name === name);
      if (!toolDef) {
        toolResults.push({ toolResult: { toolUseId, content: [{ text: 'Tool not found' }], status: 'error' } });
        continue;
      }
      try {
        const result = await toolDef.handler(input, tenantId);
        await send(endpoint, connectionId, { type: 'tool_done', tool: name, displayName: toolDef.displayName });
        toolResults.push({ toolResult: { toolUseId, content: [{ text: result.substring(0, 8000) }] } });
      } catch (err: any) {
        await send(endpoint, connectionId, { type: 'tool_done', tool: name, displayName: toolDef.displayName, error: true });
        toolResults.push({ toolResult: { toolUseId, content: [{ text: `Error: ${err.message}` }], status: 'error' } });
      }
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return fullReply;
}

// ══════════════════════════════════════════════════════════════
// Lambda Handler
// ══════════════════════════════════════════════════════════════

export const handler = async (event: any) => {
  // Handle async agent work (self-invoked with InvocationType: Event)
  if (event._agentWork) {
    const { message, agentType, tenantId, connectionId: connId } = event;
    const ep = event.endpoint || WS_ENDPOINT;
    await send(ep, connId, { type: 'typing', agentUsed: agentName(agentType) });
    try {
      const reply = await runStreamingAgent(message, agentType, tenantId, ep, connId);
      await send(ep, connId, { type: 'done', reply, agentUsed: agentName(agentType) });
    } catch (err: any) {
      console.error('[Agent Error]', err.message);
      await send(ep, connId, { type: 'error', message: 'ขออภัยค่ะ: ' + String(err.message||'').slice(0,100) });
    }
    return { statusCode: 200, body: 'OK' };
  }

  const { routeKey, connectionId, domainName, stage } = event.requestContext;
  const endpoint = `https://${domainName}/${stage}`;

  if (routeKey === '$connect') {
    await ddb.send(new PutItemCommand({ TableName: TABLE, Item: { connectionId: { S: connectionId }, ttl: { N: String(Math.floor(Date.now()/1000)+7200) } } }));
    return { statusCode: 200, body: 'Connected' };
  }
  if (routeKey === '$disconnect') {
    await ddb.send(new DeleteItemCommand({ TableName: TABLE, Key: { connectionId: { S: connectionId } } }));
    return { statusCode: 200, body: 'Disconnected' };
  }
  if (routeKey === 'sendMessage') {
    let data: any;
    try { data = JSON.parse(event.body || '{}'); } catch { data = {}; }
    const message = data.message || '';
    const tenantId = (!data.tenantId || data.tenantId === 'default') ? '00000000-0000-0000-0000-000000000001' : data.tenantId;
    const agentType = detectAgent(message);

    if (!message) {
      await send(endpoint, connectionId, { type: 'error', message: 'กรุณาพิมพ์ข้อความค่ะ' });
      return { statusCode: 200, body: 'OK' };
    }

    // Invoke self async for the actual agent work (avoids 29s API GW timeout)
    // Typing indicator will be sent by the async Lambda
    const { LambdaClient, InvokeCommand } = await import('@aws-sdk/client-lambda');
    const lc = new LambdaClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
    await lc.send(new InvokeCommand({
      FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME || 'sf7-prod-ws-agents',
      InvocationType: 'Event',
      Payload: new TextEncoder().encode(JSON.stringify({
        _agentWork: true, message, agentType, tenantId, connectionId, endpoint,
      })),
    }));

    return { statusCode: 200, body: 'OK' };
  }


  return { statusCode: 200, body: 'OK' };
};
