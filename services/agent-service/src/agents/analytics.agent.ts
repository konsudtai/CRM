/**
 * น้องวิ — Analytics Agent
 *
 * หน้าที่:
 * - วิเคราะห์ข้อมูลการขายจาก CRM จริง
 * - Forecast revenue
 * - Churn risk analysis
 * - Win rate / conversion analysis
 * - เปรียบเทียบผลงาน Sales Rep
 * - Sales cycle analysis
 * - แนะนำ action ที่ทำได้จริง
 */
import { Agent } from '@strands-agents/sdk';
import { BedrockModel } from '@strands-agents/sdk/models/bedrock';
import {
  getKpiSummary,
  getPipelineAnalysis,
  getRevenueData,
  getSalesRepPerformance,
  getChurnRiskAccounts,
  getSalesCycleAnalysis,
  getForecast,
} from '../tools/analytics.tools';

export function createAnalyticsAgent(config: {
  modelId?: string;
  region?: string;
  tenantId?: string;
}) {
  const model = new BedrockModel({
    modelId: config.modelId || 'anthropic.claude-3-5-haiku-20241022-v1:0',
    region: config.region || process.env.BEDROCK_REGION || 'ap-southeast-1',
    temperature: 0.2,
  });

  return new Agent({
    model,
    tools: [
      getKpiSummary,
      getPipelineAnalysis,
      getRevenueData,
      getSalesRepPerformance,
      getChurnRiskAccounts,
      getSalesCycleAnalysis,
      getForecast,
    ],
    systemPrompt: `คุณเป็นนักวิเคราะห์ข้อมูลการขาย ชื่อ "น้องวิ"
ตอบเป็นภาษาไทย ใช้ค่ะ

## Tenant ID: ${config.tenantId || 'unknown'}

## หน้าที่
1. วิเคราะห์ข้อมูลการขายจาก CRM — ใช้ tools ดึงข้อมูลจริงเสมอ
2. ให้ insight ที่ actionable — บอกว่าควรทำอะไร ไม่ใช่แค่ตัวเลข
3. เปรียบเทียบกับ benchmark หรือ period ก่อนหน้า
4. ระบุ risk และ opportunity ที่เห็น

## วิธีตอบ
- ใช้ตัวเลขจริงจาก API เสมอ ห้ามสมมติ
- แสดงผลเป็น bullet points อ่านง่าย
- ใช้ emoji เล็กน้อยเพื่อ highlight (📈 📉 ⚠️ ✅ 🎯)
- จบด้วยคำแนะนำ action 1-3 ข้อเสมอ
- ถ้าข้อมูลไม่พอ → บอกตรงๆ ว่าต้องการข้อมูลอะไรเพิ่ม

## ตัวอย่างคำถามที่ตอบได้
- "Forecast เดือนหน้า" → ใช้ get_forecast + get_pipeline_analysis
- "ลูกค้าเสี่ยงหาย" → ใช้ get_churn_risk_accounts
- "Win rate แต่ละ stage" → ใช้ get_pipeline_analysis
- "เปรียบเทียบทีม" → ใช้ get_sales_rep_performance
- "Sales cycle เฉลี่ย" → ใช้ get_sales_cycle_analysis
- "Revenue trend" → ใช้ get_revenue_data
- "สรุป KPI" → ใช้ get_kpi_summary`,
    printer: false,
  });
}
