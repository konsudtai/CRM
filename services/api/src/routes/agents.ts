import { Hono } from 'hono';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { query } from '../lib/db.js';

const agents = new Hono();

const PROMPTS: Record<string, string> = {
  admin: `คุณคือ "น้องแอ๊ด" AI Sales Assistant ต้อนรับลูกค้า พูดไทยสุภาพ ใช้ค่ะ เป็นมิตร ถามเชิงรุก เก็บ Lead(ชื่อ,เบอร์,บริษัท,สนใจอะไร,งบ) ค่อยๆถามทีละอย่าง แนะนำสินค้า: Cloud(เริ่ม฿150K) WebApp(เริ่ม฿300K) Support(฿5-35K/เดือน) ห้ามให้ส่วนลด ใช้ข้อมูล CRM ที่ให้มาตอบ`,
  'sales-assistant': `คุณคือ "น้องขายไว" AI Assistant ทีมขาย พูดไทย ใช้ค่ะ ช่วย assign lead สร้าง QT สรุปลูกค้า เขียน email แนะนำ next action ใช้ข้อมูล CRM จริงที่ให้มา ตอบด้วย bullet points`,
  analytics: `คุณคือ "น้องวิ" AI Analytics พูดไทย ใช้ค่ะ วิเคราะห์ข้อมูลจาก CRM จริงที่ให้มา ใช้ emoji(📈📉⚠️✅🎯) จบด้วยแนะนำ action`,
};

// Normalize tenantId - accept any string, fall back to default UUID if invalid
function normalizeTenantId(tid?: string): string {
  const def = '00000000-0000-0000-0000-000000000001';
  if (!tid) return def;
  // If it's a UUID format, use it; otherwise fallback
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRe.test(tid) ? tid : def;
}

// Pre-fetch CRM context before calling Bedrock (1 DB query, 1 Bedrock call = fast)
async function getCrmContext(tenantId: string): Promise<string> {
  try {
    const t = tenantId;
    const [leads, accounts, tasks, pipeline] = await Promise.all([
      query(t, `SELECT name,company_name,status,source,(metadata->>'estimatedValue') as value,(metadata->>'projectName') as project FROM leads WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 10`, [t]),
      query(t, `SELECT company_name,account_status,account_tier,total_revenue FROM accounts WHERE tenant_id=$1 AND deleted_at IS NULL LIMIT 5`, [t]),
      query(t, `SELECT title,status,priority,due_date FROM tasks WHERE tenant_id=$1 ORDER BY due_date LIMIT 5`, [t]),
      query(t, `SELECT status,count(*) as cnt,COALESCE(sum((metadata->>'estimatedValue')::numeric),0) as val FROM leads WHERE tenant_id=$1 GROUP BY status`, [t]),
    ]);
    return `\n\n[CRM DATA - ข้อมูลจริงจาก Database]\nLeads(${leads.rows.length}): ${JSON.stringify(leads.rows)}\nAccounts(${accounts.rows.length}): ${JSON.stringify(accounts.rows)}\nTasks(${tasks.rows.length}): ${JSON.stringify(tasks.rows)}\nPipeline: ${JSON.stringify(pipeline.rows)}`;
  } catch (e: any) {
    console.log('getCrmContext warn:', e?.message);
    return '';
  }
}

async function runAgent(message: string, agentType: string, tenantId: string): Promise<{ reply: string; model: string; ms: number }> {
  const start = Date.now();
  const systemPrompt = PROMPTS[agentType] || PROMPTS['sales-assistant'];
  const modelId = process.env.BEDROCK_MODEL_ID || 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0';
  const region = process.env.BEDROCK_REGION || 'ap-southeast-1';
  const t = normalizeTenantId(tenantId);
  const crmContext = await getCrmContext(t);
  const client = new BedrockRuntimeClient({ region });
  const res = await client.send(new ConverseCommand({
    modelId,
    system: [{ text: systemPrompt + crmContext }],
    messages: [{ role: 'user' as const, content: [{ text: message }] }],
    inferenceConfig: { maxTokens: 1024, temperature: 0.4 },
  }));
  const reply = res.output?.message?.content?.[0]?.text || 'ขออภัยค่ะ ไม่สามารถตอบได้';
  return { reply, model: modelId, ms: Date.now() - start };
}

// Primary endpoint: simple JSON response (no SSE parsing issues in browser)
agents.post('/chat', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { message, agentType, tenantId } = body as any;
  if (!message) return c.json({ error: 'message required' }, 400);
  try {
    const out = await runAgent(message, agentType || 'sales-assistant', tenantId);
    return c.json({ reply: out.reply, model: out.model, ms: out.ms });
  } catch (err: any) {
    console.error('Agent chat error:', err.message);
    return c.json({ reply: 'ขออภัยค่ะ เกิดข้อผิดพลาด: ' + String(err.message || err).slice(0, 200), error: true }, 200);
  }
});

// Legacy SSE endpoint - kept for backward compat
agents.post('/stream', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { message, agentType, tenantId } = body as any;
  if (!message) return c.json({ message: 'message required' }, 400);
  try {
    const out = await runAgent(message, agentType || 'sales-assistant', tenantId);
    return new Response(`data: ${JSON.stringify({ type: 'text', content: out.reply })}\n\ndata: [DONE]\n\n`, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: any) {
    console.error('Agent stream error:', err.message);
    return new Response(`data: ${JSON.stringify({ type: 'text', content: 'ขออภัยค่ะ: ' + String(err.message || err).slice(0, 100) })}\n\ndata: [DONE]\n\n`, {
      headers: { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*' },
    });
  }
});

// Health check
agents.get('/health', (c) => c.json({ ok: true, service: 'agents', ts: Date.now() }));

export default agents;
