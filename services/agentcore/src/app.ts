/**
 * SalesFAST 7 — AgentCore Runtime Entry Point
 *
 * Hosts all 3 AI Agents (น้องแอ๊ด, น้องขายไว, น้องวิ) on AgentCore Runtime.
 * Uses Strands Agents SDK + Express.
 *
 * Endpoints:
 *   GET  /ping         — Health check (required by AgentCore)
 *   POST /invocations  — Invoke agent (required by AgentCore)
 */
import express, { Request, Response } from 'express';
import { Agent, tool } from '@strands-agents/sdk';
import { BedrockModel } from '@strands-agents/sdk/models/bedrock';
import { z } from 'zod';

const PORT = 8080;
const app = express();
app.use(express.json());

// ── Model Configuration ──
const modelId = process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-4-6';
const region = process.env.BEDROCK_REGION || 'ap-southeast-1';

function createModel(temperature: number = 0.4) {
  return new BedrockModel({ modelId, region, temperature });
}

// ── Tools (shared across agents) ──
const currentTime = tool({
  name: 'current_time',
  description: 'Returns the current date and time in Thailand timezone',
  inputSchema: z.object({}),
  callback: () => new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
});

// ── Agent: น้องแอ๊ด (Admin AI) ──
const adminAgent = new Agent({
  model: createModel(0.3),
  tools: [currentTime],
  systemPrompt: `คุณคือ "น้องแอ๊ด" — AI Sales Assistant ของบริษัท ทำหน้าที่ต้อนรับลูกค้าที่สนใจสินค้าและบริการ

## บุคลิกภาพ
- พูดภาษาไทยสุภาพ ใช้ค่ะ/นะคะ เป็นมิตร อบอุ่น มืออาชีพ
- ตอบกระชับ ชัดเจน ไม่ยืดเยื้อ
- ถามคำถามเชิงรุกเพื่อเข้าใจความต้องการลูกค้า
- ใช้ emoji เล็กน้อยให้เป็นมิตร

## หน้าที่หลัก
1. ต้อนรับและทำความเข้าใจ — ถามว่าสนใจอะไร ธุรกิจทำอะไร มีปัญหาอะไร
2. แนะนำสินค้า/บริการที่เหมาะสม
3. เก็บข้อมูล Lead อย่างเป็นธรรมชาติ (ชื่อ, เบอร์, บริษัท, สนใจอะไร, งบ, timeline)
4. ส่งต่อทีมขาย — เมื่อได้ข้อมูลพอ

## สินค้าและบริการ
- Cloud Solutions: AWS Migration (เริ่ม ฿150K), Managed Cloud (฿25K/เดือน), Backup & DR (฿8K/เดือน)
- Software Development: Web App (เริ่ม ฿300K), Mobile App (เริ่ม ฿500K)
- IT Consulting: Digital Transformation (฿80K), Security Audit (฿120K)
- Support Plans: Basic (฿5K/เดือน), Premium (฿15K/เดือน), Enterprise (฿35K/เดือน)

## กฎสำคัญ
- ห้ามให้ส่วนลดหรือสัญญาราคาตายตัว
- อย่าถามข้อมูลทั้งหมดพร้อมกัน ค่อยๆ ถามทีละอย่างในบทสนทนา
- ถ้าตอบไม่ได้ บอกว่าจะให้ผู้เชี่ยวชาญติดต่อกลับ`,
  printer: false,
});

// ── Agent: น้องขายไว (Sales Assistant) ──
const salesAgent = new Agent({
  model: createModel(0.4),
  tools: [currentTime],
  systemPrompt: `คุณคือ "น้องขายไว" — Personal AI Assistant สำหรับทีมขาย เหมือนเพื่อนร่วมทีมที่เก่งมาก

## บุคลิกภาพ
- พูดภาษาไทย สุภาพ ใช้ค่ะ เป็นกันเอง มืออาชีพ
- ตอบตรงประเด็น ใช้ bullet points
- เสนอ action ที่ทำได้จริงเสมอ

## หน้าที่
1. ช่วย assign lead, สร้าง/ติดตาม Quotation
2. สรุปข้อมูลลูกค้า/Deal, เขียน email ติดตาม
3. แนะนำ next action, เตือน task ใกล้ deadline
4. วิเคราะห์ pipeline เบื้องต้น

## วิธีตอบ
- ถ้าถูกถามข้อมูล CRM → แนะนำ action ที่ทำได้
- ถ้าถูกสั่งให้ทำ → ยืนยันก่อน แล้วสรุปผล
- จบด้วย "มีอะไรให้ช่วยเพิ่มไหมคะ?" เมื่อเหมาะสม`,
  printer: false,
});

// ── Agent: น้องวิ (Analytics) ──
const analyticsAgent = new Agent({
  model: createModel(0.2),
  tools: [currentTime],
  systemPrompt: `คุณคือ "น้องวิ" — AI Analytics Specialist วิเคราะห์ข้อมูลการขาย

## บุคลิกภาพ
- พูดภาษาไทย ใช้ค่ะ มืออาชีพ ชัดเจน
- ใช้ตัวเลขเสมอ ไม่สมมติ
- ใช้ emoji highlight (📈 📉 ⚠️ ✅ 🎯)
- จบด้วยคำแนะนำ action 1-3 ข้อเสมอ

## หน้าที่
- วิเคราะห์ revenue, pipeline, forecast
- เปรียบเทียบ Sales Rep performance
- Churn risk, Win/Loss analysis, Sales cycle

## วิธีตอบ
- เริ่มด้วยสรุป 1 บรรทัด → รายละเอียด bullet points → 💡 แนะนำ action`,
  printer: false,
});

// ── Route agents by type ──
function getAgent(agentType: string): Agent {
  switch (agentType) {
    case 'admin': return adminAgent;
    case 'analytics': return analyticsAgent;
    default: return salesAgent;
  }
}

// ── Health Check (required by AgentCore) ──
app.get('/ping', (_req: Request, res: Response) => {
  res.json({ status: 'Healthy' });
});

// ── Invoke Agent (required by AgentCore) ──
app.post('/invocations', async (req: Request, res: Response) => {
  const { prompt, message, agentType, sessionId } = req.body || {};
  const userMessage = prompt || message || 'สวัสดี';
  const agent = getAgent(agentType || 'sales-assistant');

  try {
    // Check if client wants streaming
    const acceptSSE = req.headers.accept?.includes('text/event-stream');

    if (acceptSSE) {
      // SSE Streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      for await (const event of agent.stream(userMessage)) {
        if ((event as any).type === 'modelStreamUpdateEvent') {
          const text = (event as any).data || '';
          res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // Standard JSON response
      const result = await agent.invoke(userMessage);
      res.json({
        result: result.lastMessage || '',
        agentType: agentType || 'sales-assistant',
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Agent error:', message);
    res.status(500).json({ error: message });
  }
});

// ── Start Server ──
app.listen(PORT, '0.0.0.0', () => {
  console.log(`SalesFAST 7 AgentCore Runtime listening on port ${PORT}`);
  console.log(`  Model: ${modelId}`);
  console.log(`  Region: ${region}`);
  console.log(`  Agents: น้องแอ๊ด, น้องขายไว, น้องวิ`);
});
