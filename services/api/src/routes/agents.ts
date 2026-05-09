/**
 * AI Agents Route — Proxy to AgentCore Runtime
 *
 * Frontend calls /agents/chat → this route → AgentCore Runtime (Python/Docker)
 * AgentCore handles: agent routing, tool use, A2A, MCP, memory
 *
 * Architecture:
 *   User → /agents/chat → InvokeAgentRuntime (AgentCore)
 *                          ├── น้องแอ๊ด (Admin AI)
 *                          ├── น้องขายไว (Sales Assistant)
 *                          └── น้องวิ (Analytics)
 *
 * Fallback: If AgentCore is unavailable, falls back to direct Bedrock Converse.
 */
import { Hono } from 'hono';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { query } from '../lib/db.js';

const agents = new Hono();

const AGENTCORE_ARN = process.env.AGENTCORE_RUNTIME_ARN || '';
const AGENTCORE_REGION = process.env.AGENTCORE_REGION || process.env.BEDROCK_REGION || 'ap-southeast-1';
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0';
const REGION = process.env.BEDROCK_REGION || 'ap-southeast-1';
const USE_AGENTCORE = process.env.USE_AGENTCORE !== 'false' && !!AGENTCORE_ARN;

// ══════════════════════════════════════════════════════════════
// AgentCore Integration
// ══════════════════════════════════════════════════════════════

let agentcoreClient: any = null;

function getAgentCoreClient() {
  if (!agentcoreClient) {
    // Dynamic import to avoid issues if SDK not available
    const { BedrockAgentCoreClient } = require('@aws-sdk/client-bedrock-agentcore') || {};
    if (BedrockAgentCoreClient) {
      agentcoreClient = new BedrockAgentCoreClient({ region: AGENTCORE_REGION });
    }
  }
  return agentcoreClient;
}

async function invokeAgentCore(message: string, agentType: string, tenantId: string, sessionId?: string): Promise<{ reply: string; agentUsed: string; sessionId: string }> {
  // Use AWS SDK to invoke AgentCore (works through VPC endpoints)
  const { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } = await import('@aws-sdk/client-bedrock-agentcore');

  // AgentCore requires session ID to be 33-256 characters
  const sid = sessionId && sessionId.length >= 33
    ? sessionId
    : `sf7-session-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}pad`;

  const payload = JSON.stringify({
    message,
    agentType,
    tenantId,
    sessionId: sid,
  });

  const client = new BedrockAgentCoreClient({ region: AGENTCORE_REGION });

  // Use AbortController for reliable timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 12000);

  const command = new InvokeAgentRuntimeCommand({
    agentRuntimeArn: AGENTCORE_ARN,
    runtimeSessionId: sid,
    payload: new TextEncoder().encode(payload),
    qualifier: 'DEFAULT',
  });

  let response: any;
  try {
    response = await client.send(command, { abortSignal: abortController.signal });
  } finally {
    clearTimeout(timeoutId);
  }

  // Decode response
  const responseBody = response.response
    ? new TextDecoder().decode(response.response)
    : '{}';

  const data = JSON.parse(responseBody);
  const output = data.output || data;

  return {
    reply: output.reply || output.message || responseBody,
    agentUsed: output.agentUsed || output.agentType || agentType,
    sessionId: output.sessionId || sid,
  };
}

// ══════════════════════════════════════════════════════════════
// Fallback: Direct Bedrock Converse (if AgentCore unavailable)
// ══════════════════════════════════════════════════════════════

const bedrockClient = new BedrockRuntimeClient({ region: REGION });
const MAX_TOOL_ITERATIONS = 5;
const TIME_BUDGET_MS = 22000;

interface ToolDef {
  name: string;
  description: string;
  inputSchema: any;
  handler: (input: any, ctx: { tenantId: string; agentType: string }) => Promise<string>;
}

const CRM_TOOLS: ToolDef[] = [
  {
    name: 'get_leads',
    description: 'ค้นหา Leads — filter ตาม status, search keyword.',
    inputSchema: { json: { type: 'object', properties: { status: { type: 'string' }, search: { type: 'string' }, limit: { type: 'number', default: 10 } } } },
    handler: async (input, ctx) => {
      let where = 'tenant_id = $1'; const params: any[] = [ctx.tenantId]; let idx = 2;
      if (input.status) { where += ` AND status = $${idx}`; params.push(input.status); idx++; }
      if (input.search) { where += ` AND (name ILIKE $${idx} OR company_name ILIKE $${idx})`; params.push(`%${input.search}%`); idx++; }
      params.push(Math.min(input.limit || 10, 20));
      const res = await query(ctx.tenantId, `SELECT id, name, company_name, status, source, assigned_to, (metadata->>'estimatedValue') as value FROM leads WHERE ${where} ORDER BY created_at DESC LIMIT $${idx}`, params);
      return JSON.stringify(res.rows);
    },
  },
  {
    name: 'get_lead_detail',
    description: 'ดูรายละเอียด Lead + Sales Rep',
    inputSchema: { json: { type: 'object', properties: { leadId: { type: 'string' }, search: { type: 'string' } } } },
    handler: async (input, ctx) => {
      if (input.leadId) {
        const r = await query(ctx.tenantId, `SELECT l.*, u.first_name as rep_first, u.last_name as rep_last, u.email as rep_email, u.phone as rep_phone FROM leads l LEFT JOIN users u ON u.id = l.assigned_to WHERE l.id = $1 AND l.tenant_id = $2`, [input.leadId, ctx.tenantId]);
        return JSON.stringify(r.rows);
      }
      if (input.search) {
        const r = await query(ctx.tenantId, `SELECT l.*, u.first_name as rep_first, u.last_name as rep_last, u.email as rep_email, u.phone as rep_phone FROM leads l LEFT JOIN users u ON u.id = l.assigned_to WHERE l.tenant_id = $1 AND (l.name ILIKE $2 OR l.company_name ILIKE $2) LIMIT 5`, [ctx.tenantId, `%${input.search}%`]);
        return JSON.stringify(r.rows);
      }
      return 'Provide leadId or search';
    },
  },
  {
    name: 'get_pipeline_summary',
    description: 'สรุป Pipeline',
    inputSchema: { json: { type: 'object', properties: {} } },
    handler: async (_input, ctx) => {
      const res = await query(ctx.tenantId, `SELECT status, count(*) as count, COALESCE(sum((metadata->>'estimatedValue')::numeric), 0) as total_value FROM leads WHERE tenant_id = $1 GROUP BY status`, [ctx.tenantId]);
      return JSON.stringify(res.rows);
    },
  },
  {
    name: 'get_kpi_summary',
    description: 'สรุป KPI ทั้งหมด',
    inputSchema: { json: { type: 'object', properties: {} } },
    handler: async (_input, ctx) => {
      const [leads, accounts, tasks] = await Promise.all([
        query(ctx.tenantId, `SELECT count(*) as total, count(*) FILTER (WHERE status='Won') as won FROM leads WHERE tenant_id = $1`, [ctx.tenantId]),
        query(ctx.tenantId, `SELECT count(*) as total FROM accounts WHERE tenant_id = $1 AND deleted_at IS NULL AND account_status='active'`, [ctx.tenantId]),
        query(ctx.tenantId, `SELECT count(*) as total, count(*) FILTER (WHERE status!='Completed' AND due_date<NOW()) as overdue FROM tasks WHERE tenant_id = $1`, [ctx.tenantId]),
      ]);
      return JSON.stringify({ leads: leads.rows[0], activeAccounts: accounts.rows[0].total, tasks: tasks.rows[0] });
    },
  },
];

const PROMPTS: Record<string, string> = {
  admin: `คุณคือ "น้องแอ๊ด" — AI Sales Assistant ต้อนรับลูกค้า\nพูดภาษาไทยสุภาพ ใช้ค่ะ เป็นมิตร`,
  'sales-assistant': `คุณคือ "น้องขายไว" — Sales Personal Assistant\nพูดภาษาไทย สุภาพ ใช้ค่ะ ใช้ tools ดึงข้อมูลจริงเสมอ`,
  analytics: `คุณคือ "น้องวิ" — AI Analytics Specialist\nพูดภาษาไทย ใช้ค่ะ ใช้ emoji (📈 📉 ⚠️ ✅ 🎯)`,
};

async function fallbackDirectBedrock(message: string, agentType: string, tenantId: string): Promise<{ reply: string; toolsUsed: string[] }> {
  const start = Date.now();
  const tools = CRM_TOOLS;
  const systemPrompt = PROMPTS[agentType] || PROMPTS['sales-assistant'];
  const ctx = { tenantId, agentType };
  const toolsUsed: string[] = [];
  const toolConfig = { tools: tools.map(t => ({ toolSpec: { name: t.name, description: t.description, inputSchema: t.inputSchema } })) };
  const messages: any[] = [{ role: 'user', content: [{ text: message }] }];
  let finalReply = '';

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const overBudget = (Date.now() - start) > TIME_BUDGET_MS;
    const res = await bedrockClient.send(new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: systemPrompt + `\n[Context: tenantId=${tenantId}]` + (overBudget ? '\n[Give final answer now.]' : '') }],
      messages,
      toolConfig: !overBudget ? toolConfig : undefined,
      inferenceConfig: { maxTokens: 1024, temperature: 0.4 },
    }));

    const content = res.output?.message?.content || [];
    messages.push({ role: 'assistant', content });
    const toolUses = content.filter((c: any) => c.toolUse);

    if (toolUses.length === 0 || res.stopReason !== 'tool_use' || overBudget) {
      finalReply = content.map((c: any) => c.text || '').join('').trim();
      break;
    }

    const toolResults: any[] = [];
    for (const block of toolUses) {
      const { toolUseId, name, input } = block.toolUse;
      const toolDef = tools.find(t => t.name === name);
      toolsUsed.push(name);
      try {
        const result = toolDef ? await toolDef.handler(input, ctx) : `Tool ${name} not found`;
        toolResults.push({ toolResult: { toolUseId, content: [{ text: result.substring(0, 5000) }] } });
      } catch (err: any) {
        toolResults.push({ toolResult: { toolUseId, content: [{ text: `Error: ${err.message}` }], status: 'error' } });
      }
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return { reply: finalReply || 'ขออภัยค่ะ ไม่สามารถตอบได้ในขณะนี้', toolsUsed };
}

// ══════════════════════════════════════════════════════════════
// Routes
// ══════════════════════════════════════════════════════════════

agents.post('/chat', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { message, agentType, tenantId, sessionId } = body as any;
  if (!message) return c.json({ error: 'message required' }, 400);

  const tid = tenantId || 'default';
  const agent = agentType || 'sales-assistant';

  // ── Primary: AgentCore Runtime ──
  if (USE_AGENTCORE) {
    try {
      const result = await invokeAgentCore(message, agent, tid, sessionId);
      return c.json({
        reply: result.reply,
        agentUsed: result.agentUsed,
        sessionId: result.sessionId,
        backend: 'agentcore',
      });
    } catch (err: any) {
      console.error('[AgentCore] Error, falling back to direct Bedrock:', err.message);
      // Fall through to fallback
    }
  }

  // ── Fallback: Direct Bedrock Converse ──
  try {
    const out = await fallbackDirectBedrock(message, agent, tid);
    return c.json({
      reply: out.reply,
      toolsUsed: out.toolsUsed,
      backend: 'bedrock-converse-fallback',
    });
  } catch (err: any) {
    console.error('Agent chat error:', err.message);
    return c.json({ reply: 'ขออภัยค่ะ เกิดข้อผิดพลาด: ' + String(err.message).slice(0, 200), error: true }, 200);
  }
});

agents.post('/stream', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { message, agentType, tenantId, sessionId } = body as any;
  if (!message) return c.json({ message: 'message required' }, 400);

  const tid = tenantId || 'default';
  const agent = agentType || 'sales-assistant';

  // AgentCore doesn't support streaming natively from Lambda proxy,
  // so we invoke and return as SSE
  try {
    let reply: string;
    let backend: string;

    if (USE_AGENTCORE) {
      try {
        const result = await invokeAgentCore(message, agent, tid, sessionId);
        reply = result.reply;
        backend = 'agentcore';
      } catch {
        const out = await fallbackDirectBedrock(message, agent, tid);
        reply = out.reply;
        backend = 'bedrock-converse-fallback';
      }
    } else {
      const out = await fallbackDirectBedrock(message, agent, tid);
      reply = out.reply;
      backend = 'bedrock-converse-fallback';
    }

    return new Response(
      `data: ${JSON.stringify({ type: 'text', content: reply, backend })}\n\ndata: [DONE]\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (err: any) {
    return new Response(
      `data: ${JSON.stringify({ type: 'text', content: 'ขออภัยค่ะ: ' + String(err.message).slice(0, 100) })}\n\ndata: [DONE]\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*' } },
    );
  }
});

agents.get('/health', (c) => c.json({
  ok: true,
  service: 'agents',
  backend: USE_AGENTCORE ? 'agentcore' : 'bedrock-converse',
  agentcoreArn: AGENTCORE_ARN || null,
  features: ['tool_use', 'a2a', 'multi_agent', 'mcp'],
  agents: ['admin', 'sales-assistant', 'analytics'],
  ts: Date.now(),
}));

export default agents;
