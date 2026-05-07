import { Hono } from 'hono';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const agents = new Hono();

const PROMPTS: Record<string, string> = {
  admin: `คุณคือ "น้องแอ๊ด" AI Sales Assistant ต้อนรับลูกค้า พูดไทย สุภาพ ใช้ค่ะ เป็นมิตร ถามเชิงรุก เก็บข้อมูล Lead(ชื่อ,เบอร์,บริษัท,สนใจอะไร,งบ) ค่อยๆถามทีละอย่าง แนะนำสินค้า: Cloud(เริ่ม฿150K) WebApp(เริ่ม฿300K) MobileApp(เริ่ม฿500K) ITConsulting(฿80K) Support(฿5-35K/เดือน) ห้ามให้ส่วนลด ตอบสั้นกระชับ`,
  'sales-assistant': `คุณคือ "น้องขายไว" AI Assistant ทีมขาย พูดไทย ใช้ค่ะ เป็นกันเอง ช่วย assign lead สร้าง QT สรุปลูกค้า เขียน email แนะนำ next action เตือน task ตอบตรงประเด็น ใช้ bullet points`,
  analytics: `คุณคือ "น้องวิ" AI Analytics พูดไทย ใช้ค่ะ วิเคราะห์ revenue pipeline forecast เปรียบเทียบ Sales Rep churn risk ใช้ตัวเลขจริง ใช้ emoji(📈📉⚠️✅🎯) จบด้วยแนะนำ action`,
};

agents.post('/stream', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { message, agentType } = body;
  if (!message) return c.json({ message: 'message required' }, 400);

  const systemPrompt = PROMPTS[agentType] || PROMPTS['sales-assistant'];
  const modelId = process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-4-6';
  const region = process.env.BEDROCK_REGION || 'ap-southeast-1';

  try {
    const client = new BedrockRuntimeClient({ region });
    const res = await client.send(new ConverseCommand({
      modelId,
      system: [{ text: systemPrompt }],
      messages: [{ role: 'user' as const, content: [{ text: message }] }],
      inferenceConfig: { maxTokens: 1024, temperature: 0.4 },
    }));

    const text = res.output?.message?.content?.[0]?.text || 'ขออภัยค่ะ ไม่สามารถตอบได้';
    return new Response(`data: ${JSON.stringify({type:'text',content:text})}\n\ndata: [DONE]\n\n`, {
      headers: {'Content-Type':'text/event-stream','Cache-Control':'no-cache','Access-Control-Allow-Origin':'*'},
    });
  } catch (err: any) {
    console.error('Bedrock error:', err.message);
    return new Response(`data: ${JSON.stringify({type:'text',content:'ขออภัยค่ะ: '+err.message.slice(0,100)})}\n\ndata: [DONE]\n\n`, {
      headers: {'Content-Type':'text/event-stream','Access-Control-Allow-Origin':'*'},
    });
  }
});

export default agents;
