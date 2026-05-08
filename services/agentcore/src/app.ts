/**
 * SalesFAST 7 — AgentCore Runtime (v2)
 *
 * Multi-Agent AI with:
 *   - A2A (Agent-to-Agent) communication
 *   - MCP (Model Context Protocol) for CRM database access
 *   - 3 Agents: น้องแอ๊ด, น้องขายไว, น้องวิ
 *
 * Endpoints (required by AgentCore):
 *   GET  /ping         — Health check
 *   POST /invocations  — Invoke agent
 */
import express, { Request, Response } from 'express';
import { Agent, tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { initMcpTools, getMcpTools } from './mcp-client.js';

const PORT = 8080;
const app = express();
app.use(express.json({ limit: '1mb' }));

// ── Configuration ──
const modelId = process.env.BEDROCK_MODEL_ID || 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0';
const region = process.env.BEDROCK_REGION || 'ap-southeast-1';

// ══════════════════════════════════════════════════════════════
// A2A (Agent-to-Agent) Communication
// ══════════════════════════════════════════════════════════════

// Forward reference — resolved after agents are created
let invokeAgent: (agentType: string, message: string, tenantId: string) => Promise<string>;

const askSalesAssistant = tool({
  name: 'ask_sales_assistant',
  description: `ส่งคำถามไปให้ "น้องขายไว" (Sales Assistant) ตอบ — ใช้เมื่อลูกค้าถามเรื่องที่ต้องดึงข้อมูลจาก CRM เช่น:
- "ใครดูแลผมอยู่?" → หาข้อมูล Sales Rep
- "สถานะ Lead ของผม?" → ดึงข้อมูล Lead
- "Quotation ที่ส่งไป?" → ดึงข้อมูล QT`,
  inputSchema: z.object({
    question: z.string().describe('คำถามที่ต้องการถามน้องขายไว'),
    tenantId: z.string().describe('Tenant ID'),
    context: z.string().optional().describe('ข้อมูลเพิ่มเติม เช่น ชื่อลูกค้า'),
  }),
  handler: async (input: { question: string; tenantId: string; context?: string }) => {
    const msg = `[A2A จาก น้องแอ๊ด]\nลูกค้าถาม: "${input.question}"\nContext: ${input.context || 'ไม่มี'}\nTenant: ${input.tenantId}\n\nกรุณาตอบข้อมูลที่ลูกค้าต้องการ ตอบสั้นกระชับ`;
    const reply = await invokeAgent('sales-assistant', msg, input.tenantId);
    return reply;
  },
});

const askAnalyticsAgent = tool({
  name: 'ask_analytics_agent',
  description: `ส่งคำถามไปให้ "น้องวิ" (Analytics) วิเคราะห์ — ใช้เมื่อต้องการ:
- Forecast ยอดขาย
- Win rate / Conversion analysis
- เปรียบเทียบผลงาน Sales Rep
- Churn risk analysis`,
  inputSchema: z.object({
    question: z.string().describe('คำถามวิเคราะห์'),
    tenantId: z.string().describe('Tenant ID'),
  }),
  handler: async (input: { question: string; tenantId: string }) => {
    const msg = `[A2A Request]\nTenant: ${input.tenantId}\n${input.question}`;
    const reply = await invokeAgent('analytics', msg, input.tenantId);
    return reply;
  },
});

// ══════════════════════════════════════════════════════════════
// Agent Definitions
// ══════════════════════════════════════════════════════════════

let adminAgent: Agent;
let salesAgent: Agent;
let analyticsAgent: Agent;
let agentsReady = false;

async function initAgents() {
  if (agentsReady) return;

  // Initialize MCP tools (CRM database access)
  await initMcpTools();
  const mcpTools = getMcpTools();

  console.log(`[AgentCore] MCP tools loaded: ${mcpTools.length} tools`);
  console.log(`[AgentCore] Tools: ${mcpTools.map((t: any) => t.name || t.toolSpec?.name).join(', ')}`);

  // ── น้องแอ๊ด (Admin AI) ──
  // Has A2A tools to delegate to other agents + basic CRM tools
  adminAgent = new Agent({
    modelId,
    region,
    temperature: 0.3,
    tools: [askSalesAssistant, askAnalyticsAgent, ...mcpTools],
    systemPrompt: `คุณคือ "น้องแอ๊ด" — AI Sales Assistant ต้อนรับลูกค้า

## บุคลิกภาพ
- พูดภาษาไทยสุภาพ ใช้ค่ะ/นะคะ เป็นมิตร อบอุ่น
- ถามคำถามเชิงรุกเพื่อเข้าใจความต้องการ
- ค่อยๆ ถามทีละอย่าง ไม่ถามทั้งหมดพร้อมกัน

## หน้าที่หลัก
1. ต้อนรับลูกค้า ทำความเข้าใจความต้องการ
2. แนะนำสินค้า/บริการ: Cloud(เริ่ม฿150K) WebApp(เริ่ม฿300K) Support(฿5-35K/เดือน)
3. เก็บข้อมูล Lead (ชื่อ, เบอร์, บริษัท, สนใจอะไร, งบ)
4. ใช้ create_lead สร้าง Lead เมื่อได้ข้อมูลพอ

## Agent-to-Agent (A2A)
- ใช้ ask_sales_assistant เมื่อลูกค้าถามเรื่อง CRM (ใครดูแล, สถานะ Lead, QT)
- ใช้ ask_analytics_agent เมื่อลูกค้าถามข้อมูลวิเคราะห์
- ห้ามตอบข้อมูล CRM เอง ต้องถามน้องขายไวเสมอ

## กฎสำคัญ
- ห้ามให้ส่วนลดหรือสัญญาราคาตายตัว
- ถ้าตอบไม่ได้ บอกว่าจะให้ผู้เชี่ยวชาญติดต่อกลับ`,
  });

  // ── น้องขายไว (Sales Assistant) ──
  // Has full CRM MCP tools — can read/write database
  salesAgent = new Agent({
    modelId,
    region,
    temperature: 0.4,
    tools: [askAnalyticsAgent, ...mcpTools],
    systemPrompt: `คุณคือ "น้องขายไว" — Personal AI Assistant สำหรับทีมขาย

## บุคลิกภาพ
- พูดภาษาไทย สุภาพ ใช้ค่ะ เป็นกันเอง มืออาชีพ
- ตอบตรงประเด็น ใช้ bullet points
- เสนอ action ที่ทำได้จริงเสมอ

## หน้าที่ (ใช้ MCP Tools ทำงานจริง)
1. ค้นหา/จัดการ Lead — get_leads, get_lead_detail, create_lead, update_lead
2. ดูข้อมูลลูกค้า — get_accounts, get_account_detail
3. จัดการ Tasks — get_tasks, create_task
4. ดู Quotations — get_quotations, get_products
5. สรุป Pipeline — get_pipeline_summary, get_kpi_summary
6. ดูผลงานทีม — get_sales_rep_performance

## Agent-to-Agent (A2A)
- ใช้ ask_analytics_agent เมื่อต้องการ forecast หรือวิเคราะห์เชิงลึก

## วิธีตอบ
- ดึงข้อมูลจาก CRM ก่อนตอบเสมอ (ใช้ tools)
- ถ้าถูกถามข้อมูล → ดึงจาก DB แล้วสรุปให้
- ถ้าถูกสั่งให้ทำ → ยืนยันก่อน แล้วทำ แล้วสรุปผล
- จบด้วย "มีอะไรให้ช่วยเพิ่มไหมคะ?" เมื่อเหมาะสม`,
  });

  // ── น้องวิ (Analytics) ──
  // Has CRM MCP tools for data access
  analyticsAgent = new Agent({
    modelId,
    region,
    temperature: 0.2,
    tools: [...mcpTools],
    systemPrompt: `คุณคือ "น้องวิ" — AI Analytics Specialist วิเคราะห์ข้อมูลการขาย

## บุคลิกภาพ
- พูดภาษาไทย ใช้ค่ะ มืออาชีพ ชัดเจน
- ใช้ตัวเลขจริงจาก CRM เสมอ ไม่สมมติ
- ใช้ emoji highlight (📈 📉 ⚠️ ✅ 🎯)
- จบด้วยคำแนะนำ action 1-3 ข้อเสมอ

## หน้าที่ (ใช้ MCP Tools ดึงข้อมูลจริง)
- วิเคราะห์ revenue, pipeline, forecast — get_kpi_summary, get_pipeline_summary
- เปรียบเทียบ Sales Rep performance — get_sales_rep_performance
- Win/Loss analysis — get_leads (filter by status)
- Churn risk — get_accounts (filter by status)

## วิธีตอบ
- ดึงข้อมูลจาก CRM ก่อนวิเคราะห์เสมอ
- เริ่มด้วยสรุป 1 บรรทัด → รายละเอียด bullet points → 💡 แนะนำ action`,
  });

  // Wire up A2A invokeAgent function
  invokeAgent = async (agentType: string, message: string, tenantId: string): Promise<string> => {
    const contextMsg = `[Context: tenantId=${tenantId}]\n${message}`;
    let agent: Agent;
    switch (agentType) {
      case 'admin': agent = adminAgent; break;
      case 'analytics': agent = analyticsAgent; break;
      default: agent = salesAgent; break;
    }
    const result = await agent.invoke(contextMsg);
    return (result as any).output?.text || (result as any).message || JSON.stringify(result);
  };

  agentsReady = true;
  console.log('[AgentCore] All agents initialized with A2A + MCP');
}

// ══════════════════════════════════════════════════════════════
// Agent Routing
// ══════════════════════════════════════════════════════════════

function detectAgentType(message: string): string {
  const lower = message.toLowerCase();

  const analyticsKeywords = [
    'forecast', 'พยากรณ์', 'churn', 'เสี่ยงหาย', 'win rate', 'conversion',
    'เปรียบเทียบ', 'performance', 'ผลงาน', 'revenue', 'trend',
    'kpi', 'สรุปยอด', 'วิเคราะห์', 'avg deal', 'pipeline analysis',
  ];

  const adminKeywords = [
    'สนใจสินค้า', 'ขอใบเสนอราคา', 'ติดต่อกลับ', 'สอบถามราคา',
    'บริการอะไร', 'ราคาเท่าไหร่', 'แพ็คเกจ',
  ];

  if (analyticsKeywords.some(k => lower.includes(k))) return 'analytics';
  if (adminKeywords.some(k => lower.includes(k))) return 'admin';
  return 'sales-assistant';
}

function getAgent(agentType: string): Agent {
  switch (agentType) {
    case 'admin': return adminAgent;
    case 'analytics': return analyticsAgent;
    default: return salesAgent;
  }
}

function getAgentName(agentType: string): string {
  switch (agentType) {
    case 'admin': return 'น้องแอ๊ด';
    case 'analytics': return 'น้องวิ';
    default: return 'น้องขายไว';
  }
}

// ══════════════════════════════════════════════════════════════
// AgentCore Endpoints
// ══════════════════════════════════════════════════════════════

// Health Check (required by AgentCore)
app.get('/ping', (_req: Request, res: Response) => {
  res.json({ status: 'Healthy', agents: 3, mcp: agentsReady });
});

// Invoke Agent (required by AgentCore)
app.post('/invocations', async (req: Request, res: Response) => {
  try {
    await initAgents();

    const { prompt, message, agentType, tenantId, sessionId } = req.body || {};
    const userMessage = prompt || message || 'สวัสดี';
    const tid = tenantId || '00000000-0000-0000-0000-000000000001';

    // Determine agent
    const resolvedType = agentType === 'auto' || !agentType
      ? detectAgentType(userMessage)
      : agentType;

    const agent = getAgent(resolvedType);
    const agentName = getAgentName(resolvedType);

    // Check if client wants streaming
    const acceptSSE = req.headers.accept?.includes('text/event-stream');

    if (acceptSSE) {
      // SSE Streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      res.write(`data: ${JSON.stringify({ type: 'agent_selected', agent: agentName })}\n\n`);

      const contextMsg = `[Context: tenantId=${tid}]\n${userMessage}`;
      for await (const event of agent.stream(contextMsg)) {
        if ((event as any).type === 'modelStreamUpdateEvent') {
          res.write(`data: ${JSON.stringify({ type: 'text', content: (event as any).data || '' })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // JSON response
      const contextMsg = `[Context: tenantId=${tid}]\n${userMessage}`;
      const result = await agent.invoke(contextMsg);
      const reply = (result as any).output?.text || (result as any).message || '';

      res.json({
        reply,
        agentUsed: agentName,
        agentType: resolvedType,
        model: modelId,
      });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[AgentCore] Error:', msg);
    res.status(500).json({ error: msg, reply: 'ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่ค่ะ' });
  }
});

// Additional endpoint for frontend compatibility (same as /invocations)
app.post('/agents/chat', async (req: Request, res: Response) => {
  // Rewrite to /invocations format
  req.body = { ...req.body, prompt: req.body.message };
  req.url = '/invocations';
  app.handle(req, res);
});

// ── Start Server ──
app.listen(PORT, '0.0.0.0', () => {
  console.log('═══════════════════════════════════════════════════');
  console.log('  SalesFAST 7 — AgentCore Runtime v2');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Port:    ${PORT}`);
  console.log(`  Model:   ${modelId}`);
  console.log(`  Region:  ${region}`);
  console.log(`  Agents:  น้องแอ๊ด, น้องขายไว, น้องวิ`);
  console.log(`  A2A:     ✅ Enabled`);
  console.log(`  MCP:     ✅ CRM Database (PostgreSQL)`);
  console.log('═══════════════════════════════════════════════════');

  // Pre-initialize agents on startup
  initAgents().catch(err => console.error('[AgentCore] Init error:', err.message));
});
