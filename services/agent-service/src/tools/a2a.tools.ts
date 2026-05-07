/**
 * Agent-to-Agent (A2A) Tools
 *
 * Enables agents to communicate with each other:
 * - น้องแอ๊ด → น้องขายไว: ถามข้อมูล CRM, Sales Rep, Lead status
 * - น้องแอ๊ด → น้องวิ: ถามข้อมูลวิเคราะห์
 * - น้องขายไว → น้องวิ: ถาม forecast, analytics
 */
import { tool } from '@strands-agents/sdk';
import { z } from 'zod';

// Reference to the orchestrator will be injected at runtime
let orchestratorRef: any = null;

export function setOrchestratorRef(orch: any) {
  orchestratorRef = orch;
}

/**
 * น้องแอ๊ด → น้องขายไว
 * ใช้เมื่อลูกค้าถามเรื่องที่ต้องดึงข้อมูลจาก CRM เช่น:
 * - ใครดูแลอยู่? (Sales Rep info)
 * - สถานะ Lead/Deal เป็นยังไง?
 * - มี Quotation อะไรบ้าง?
 */
export const askSalesAssistant = tool({
  name: 'ask_sales_assistant',
  description: `ส่งคำถามไปให้ "น้องขายไว" (Sales Assistant Agent) ตอบ — ใช้เมื่อลูกค้าถามเรื่องที่ต้องดึงข้อมูลจาก CRM เช่น:
- "ใครดูแลผมอยู่?" → น้องขายไวจะหาข้อมูล Sales Rep (ชื่อ, เบอร์, email)
- "สถานะ Lead ของผมเป็นยังไง?" → น้องขายไวจะดึงข้อมูล Lead
- "Quotation ที่ส่งไปเป็นยังไงบ้าง?" → น้องขายไวจะดึงข้อมูล QT
- เรื่องอื่นๆ ที่ต้องการข้อมูลจากระบบ CRM`,
  inputSchema: z.object({
    question: z.string().describe('คำถามที่ต้องการถามน้องขายไว (ภาษาไทยหรืออังกฤษ)'),
    tenantId: z.string().describe('Tenant ID'),
    context: z.string().optional().describe('ข้อมูลเพิ่มเติม เช่น ชื่อลูกค้า, เบอร์โทร, LINE ID ที่ใช้ระบุตัวตน'),
  }),
  callback: async (input) => {
    if (!orchestratorRef) {
      return JSON.stringify({ error: 'Sales assistant not available', message: 'ขออภัยค่ะ ระบบยังไม่พร้อม กรุณาลองใหม่ภายหลัง' });
    }

    try {
      const response = await orchestratorRef.chat({
        message: `[A2A Request from Admin AI]\nลูกค้าถาม: "${input.question}"\nContext: ${input.context || 'ไม่มี'}\nTenant: ${input.tenantId}\n\nกรุณาตอบข้อมูลที่ลูกค้าต้องการ ตอบสั้นกระชับ เหมาะกับส่งต่อให้ลูกค้า`,
        agentType: 'sales-assistant',
        context: { fromAgent: 'admin-ai', tenantId: input.tenantId },
      });

      return JSON.stringify({
        answer: response.message,
        agentUsed: response.agentUsed,
        toolsUsed: response.toolsUsed,
      });
    } catch (err: any) {
      return JSON.stringify({ error: err.message, message: 'ไม่สามารถดึงข้อมูลได้ในขณะนี้' });
    }
  },
});

/**
 * น้องแอ๊ด/น้องขายไว → น้องวิ
 * ใช้เมื่อต้องการข้อมูลวิเคราะห์เชิงลึก
 */
export const askAnalyticsAgent = tool({
  name: 'ask_analytics_agent',
  description: `ส่งคำถามไปให้ "น้องวิ" (Analytics Agent) วิเคราะห์ — ใช้เมื่อต้องการ:
- Forecast ยอดขาย
- Win rate / Conversion analysis
- เปรียบเทียบผลงาน Sales Rep
- Churn risk analysis
- Sales cycle analysis`,
  inputSchema: z.object({
    question: z.string().describe('คำถามวิเคราะห์ที่ต้องการถามน้องวิ'),
    tenantId: z.string().describe('Tenant ID'),
  }),
  callback: async (input) => {
    if (!orchestratorRef) {
      return JSON.stringify({ error: 'Analytics agent not available' });
    }

    try {
      const response = await orchestratorRef.chat({
        message: `[A2A Request]\n${input.question}`,
        agentType: 'analytics',
        context: { fromAgent: 'a2a', tenantId: input.tenantId },
      });

      return JSON.stringify({
        answer: response.message,
        agentUsed: response.agentUsed,
      });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
});
