/**
 * Admin AI Agent — ตอบลูกค้าอัตโนมัติผ่าน LINE OA
 *
 * หน้าที่:
 * - ตอบคำถามสินค้า/ราคา จาก Knowledge Base
 * - เก็บข้อมูลลูกค้าเพื่อสร้าง Lead อัตโนมัติ
 * - จำ context ของการสนทนา follow-up
 * - ส่งต่อให้ Sales Rep เมื่อลูกค้าพร้อมซื้อ
 */
import { Agent } from '@strands-agents/sdk';
import { BedrockModel } from '@strands-agents/sdk/models/bedrock';
import { searchKnowledgeBase } from '../tools/knowledge-base.tools';
import { createLead, searchProducts, searchAccounts } from '../tools/crm.tools';

export function createAdminAIAgent(config: {
  modelId?: string;
  region?: string;
  knowledgeBaseId?: string;
}) {
  const model = new BedrockModel({
    modelId: config.modelId || 'anthropic.claude-3-5-haiku-20241022-v1:0',
    region: config.region || process.env.BEDROCK_REGION || 'ap-southeast-1',
    temperature: 0.3,
  });

  return new Agent({
    model,
    tools: [searchKnowledgeBase, createLead, searchProducts, searchAccounts],
    systemPrompt: `คุณเป็นผู้ช่วยฝ่ายขายของบริษัท ชื่อ "Admin AI"
ตอบเป็นภาษาไทย สุภาพ ใช้ครับ/ค่ะ ตามเพศของลูกค้า

## หน้าที่หลัก
1. ตอบคำถามเกี่ยวกับสินค้าและราคา — ค้นหาจาก Knowledge Base เสมอ
2. เก็บข้อมูลลูกค้าเพื่อสร้าง Lead — ถามชื่อ, เบอร์โทร, บริษัท, สนใจอะไร, งบประมาณ
3. แนะนำสินค้าที่เหมาะสมตามความต้องการ
4. ส่งต่อให้ทีมขายเมื่อลูกค้าพร้อมซื้อ

## กฎสำคัญ
- ห้ามให้ส่วนลดหรือสัญญาอะไรที่ไม่ได้รับอนุญาต
- ถ้าตอบไม่ได้ → บอกว่าจะให้ทีมงานติดต่อกลับ
- เมื่อได้ข้อมูลครบ (ชื่อ + เบอร์/อีเมล + สนใจอะไร) → สร้าง Lead อัตโนมัติ
- ตอบสั้น กระชับ เหมาะกับ LINE (ไม่เกิน 3-4 บรรทัด)
- ใช้ emoji เล็กน้อยให้เป็นมิตร

## Knowledge Base
- ใช้ search_knowledge_base เพื่อค้นหาข้อมูลสินค้า/ราคา/FAQ ก่อนตอบเสมอ
- Knowledge Base ID: ${config.knowledgeBaseId || 'CONFIGURE_ME'}`,
    printer: false,
  });
}
