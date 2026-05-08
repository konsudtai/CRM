/**
 * AI Agents Route — Proxy to AgentCore Runtime
 *
 * Frontend → CloudFront → /agents/chat → Lambda (this) → AgentCore Runtime
 *
 * Why Lambda proxy?
 *  - Frontend calls HTTPS URL on same origin (no CORS issues)
 *  - Lambda has AWS credentials to sign InvokeAgentRuntime calls
 *  - Falls back to legacy Bedrock Converse if AgentCore ARN not set
 */
import { Hono } from 'hono';
import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { query } from '../lib/db.js';
import { randomUUID } from 'crypto';

const agents = new Hono();

const REGION = process.env.BEDROCK_REGION || 'ap-southeast-1';
const AGENTCORE_RUNTIME_ARN = process.env.AGENTCORE_RUNTIME_ARN || '';
const FALLBACK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0';

const agentCoreClient = AGENTCORE_RUNTIME_ARN
  ? new BedrockAgentCoreClient({ region: REGION })
  : null;

const bedrockClient = new BedrockRuntimeClient({ region: REGION });

// ══════════════════════════════════════════════════════════════
// Session ID (33+ chars required by AgentCore)
// ══════════════════════════════════════════════════════════════

function makeSessionId(providedId?: string): string {
  if (providedId && providedId.length >= 33) return providedId;
  // Pad: UUID is 36 chars, always passes
  return (providedId || 'session') + '-' + randomUUID();
}

function normalizeTenantId(tid?: string): string {
  const def = '00000000-0000-0000-0000-000000000001';
  if (!tid) return def;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRe.test(tid) ? tid : def;
}

// ══════════════════════════════════════════════════════════════
// Primary: AgentCore Runtime invocation
// ══════════════════════════════════════════════════════════════

async function invokeAgentCore(params: {
  message: string;
  agentType: string;
  tenantId: string;
  sessionId: string;
}): Promise<{ reply: string; agentUsed?: string; ms: number }> {
  if (!agentCoreClient) {
    throw new Error('AgentCore not configured');
  }

  const start = Date.now();
  const payload = JSON.stringify({
    message: params.message,
    agentType: params.agentType,
    tenantId: params.tenantId,
    sessionId: params.sessionId,
  });

  const cmd = new InvokeAgentRuntimeCommand({
    agentRuntimeArn: AGENTCORE_RUNTIME_ARN,
    runtimeSessionId: params.sessionId,
    payload: Buffer.from(payload),
    qualifier: 'DEFAULT',
  });

  const res = await agentCoreClient.send(cmd);
  // Response body is a stream of bytes — collect into string
  let body = '';
  if (res.response) {
    // In Node 18+ AWS SDK v3 returns a byte array or readable
    const chunks: Uint8Array[] = [];
    // @ts-ignore — SDK type varies by version
    for await (const chunk of res.response as any) {
      chunks.push(chunk);
    }
    body = Buffer.concat(chunks).toString('utf-8');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = { reply: body };
  }

  // AgentCore wraps response as {"output": {...}}
  const output = parsed.output || parsed;
  return {
    reply: output.reply || output.message || JSON.stringify(output),
    agentUsed: output.agentUsed,
    ms: Date.now() - start,
  };
}

// ══════════════════════════════════════════════════════════════
// Fallback: Simple Bedrock Converse (used when AgentCore unavailable)
// ══════════════════════════════════════════════════════════════

const FALLBACK_PROMPTS: Record<string, string> = {
  admin: `คุณคือ "น้องแอ๊ด" AI Sales Assistant ต้อนรับลูกค้า พูดไทยสุภาพ ใช้ค่ะ เป็นมิตร ถามเชิงรุก เก็บ Lead(ชื่อ,เบอร์,บริษัท,สนใจอะไร,งบ) ค่อยๆถามทีละอย่าง แนะนำสินค้า: Cloud(เริ่ม฿150K) WebApp(เริ่ม฿300K) Support(฿5-35K/เดือน) ห้ามให้ส่วนลด ใช้ข้อมูล CRM ที่ให้มาตอบ`,
  'sales-assistant': `คุณคือ "น้องขายไว" AI Assistant ทีมขาย พูดไทย ใช้ค่ะ ช่วย assign lead สร้าง QT สรุปลูกค้า เขียน email แนะนำ next action ใช้ข้อมูล CRM จริงที่ให้มา ตอบด้วย bullet points`,
  analytics: `คุณคือ "น้องวิ" AI Analytics พูดไทย ใช้ค่ะ วิเคราะห์ข้อมูลจาก CRM จริงที่ให้มา ใช้ emoji(📈📉⚠️✅🎯) จบด้วยแนะนำ action`,
};

async function getCrmContext(tenantId: string): Promise<string> {
  try {
    const [leads, accounts, tasks, pipeline] = await Promise.all([
      query(tenantId, `SELECT name,company_name,status,source,(metadata->>'estimatedValue') as value,(metadata->>'projectName') as project FROM leads WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 10`, [tenantId]),
      query(tenantId, `SELECT company_name,account_status,account_tier,total_revenue FROM accounts WHERE tenant_id=$1 AND deleted_at IS NULL LIMIT 5`, [tenantId]),
      query(tenantId, `SELECT title,status,priority,due_date FROM tasks WHERE tenant_id=$1 ORDER BY due_date LIMIT 5`, [tenantId]),
      query(tenantId, `SELECT status,count(*) as cnt,COALESCE(sum((metadata->>'estimatedValue')::numeric),0) as val FROM leads WHERE tenant_id=$1 GROUP BY status`, [tenantId]),
    ]);
    return `\n\n[CRM DATA]\nLeads(${leads.rows.length}): ${JSON.stringify(leads.rows)}\nAccounts: ${JSON.stringify(accounts.rows)}\nTasks: ${JSON.stringify(tasks.rows)}\nPipeline: ${JSON.stringify(pipeline.rows)}`;
  } catch {
    return '';
  }
}

async function invokeFallback(params: {
  message: string;
  agentType: string;
  tenantId: string;
}): Promise<{ reply: string; ms: number }> {
  const start = Date.now();
  const systemPrompt = FALLBACK_PROMPTS[params.agentType] || FALLBACK_PROMPTS['sales-assistant'];
  const crmContext = await getCrmContext(params.tenantId);

  const res = await bedrockClient.send(new ConverseCommand({
    modelId: FALLBACK_MODEL_ID,
    system: [{ text: systemPrompt + crmContext }],
    messages: [{ role: 'user' as const, content: [{ text: params.message }] }],
    inferenceConfig: { maxTokens: 1024, temperature: 0.4 },
  }));
  const reply = res.output?.message?.content?.[0]?.text || 'ขออภัยค่ะ ไม่สามารถตอบได้';
  return { reply, ms: Date.now() - start };
}

// ══════════════════════════════════════════════════════════════
// HTTP Routes
// ══════════════════════════════════════════════════════════════

agents.post('/chat', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { message, agentType, tenantId, sessionId } = body as any;
  if (!message) return c.json({ error: 'message required' }, 400);

  const tid = normalizeTenantId(tenantId);
  const sid = makeSessionId(sessionId);
  const type = agentType || 'sales-assistant';

  try {
    if (agentCoreClient) {
      const out = await invokeAgentCore({ message, agentType: type, tenantId: tid, sessionId: sid });
      return c.json({
        reply: out.reply,
        agentUsed: out.agentUsed,
        backend: 'agentcore',
        sessionId: sid,
        ms: out.ms,
      });
    }
    // Fallback
    const out = await invokeFallback({ message, agentType: type, tenantId: tid });
    return c.json({
      reply: out.reply,
      backend: 'fallback',
      model: FALLBACK_MODEL_ID,
      ms: out.ms,
    });
  } catch (err: any) {
    console.error('Agent chat error:', err.message);
    // Try fallback if AgentCore errored
    if (agentCoreClient) {
      try {
        const out = await invokeFallback({ message, agentType: type, tenantId: tid });
        return c.json({
          reply: out.reply,
          backend: 'fallback-after-error',
          agentCoreError: err.message,
          ms: out.ms,
        });
      } catch (err2: any) {
        return c.json({ reply: 'ขออภัยค่ะ เกิดข้อผิดพลาด: ' + String(err2.message).slice(0, 200), error: true }, 200);
      }
    }
    return c.json({ reply: 'ขออภัยค่ะ เกิดข้อผิดพลาด: ' + String(err.message).slice(0, 200), error: true }, 200);
  }
});

// Legacy SSE endpoint for backward compat
agents.post('/stream', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { message, agentType, tenantId, sessionId } = body as any;
  if (!message) return c.json({ message: 'message required' }, 400);
  const tid = normalizeTenantId(tenantId);
  const sid = makeSessionId(sessionId);
  const type = agentType || 'sales-assistant';

  try {
    let reply: string;
    if (agentCoreClient) {
      const out = await invokeAgentCore({ message, agentType: type, tenantId: tid, sessionId: sid });
      reply = out.reply;
    } else {
      const out = await invokeFallback({ message, agentType: type, tenantId: tid });
      reply = out.reply;
    }
    return new Response(
      `data: ${JSON.stringify({ type: 'text', content: reply })}\n\ndata: [DONE]\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (err: any) {
    return new Response(
      `data: ${JSON.stringify({ type: 'text', content: 'ขออภัยค่ะ: ' + String(err.message).slice(0, 100) })}\n\ndata: [DONE]\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*' } },
    );
  }
});

// Health check
agents.get('/health', (c) => c.json({
  ok: true,
  service: 'agents',
  backend: agentCoreClient ? 'agentcore' : 'fallback',
  agentcoreArn: AGENTCORE_RUNTIME_ARN ? '...' + AGENTCORE_RUNTIME_ARN.slice(-20) : null,
  ts: Date.now(),
}));

export default agents;
