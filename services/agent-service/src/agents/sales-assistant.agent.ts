/**
 * น้องขายไว — Sales Personal Assistant (Agentic AI)
 *
 * Full capabilities:
 * 1. Smart Lead Qualification & Scoring
 * 2. Auto-create Activity Log (every action logged to DB)
 * 3. Smart Follow-up Scheduling
 * 4. Conversation Summary & Handoff Notes
 * 5. Deal Health Monitoring
 * 6. Meeting Prep & Post-meeting Actions
 * 7. Smart Email/LINE Composer
 * 8. Auto-tagging & Categorization
 * 9. Proactive Daily Digest (via scheduler)
 * 10. Win/Loss Analysis & Coaching
 *
 * All actions write to the real DB via the same APIs the UI uses.
 * Users can still do everything manually through the UI.
 */
import { Agent } from '@strands-agents/sdk';
import { BedrockModel } from '@strands-agents/sdk/models/bedrock';

// CRM Tools (existing)
import {
  searchLeads, assignLead, createLead,
  searchAccounts, getAccountDetail,
  createQuotation, getQuotation, approveQuotation,
  searchProducts, searchTasks, createTask,
  searchOpportunities, draftEmail,
} from '../tools/crm.tools';

// Activity & Notification Tools (Feature #2, #4)
import {
  logActivity, createNote,
  sendNotification, sendLineMessage,
} from '../tools/activity.tools';

// Scoring & Tagging Tools (Feature #1, #8)
import {
  updateLeadScore, updateAccountTier,
  addAccountTag, getLeadConversationHistory,
  getSalesRepWorkload,
} from '../tools/scoring.tools';

// Deal Health Tools (Feature #5, #10)
import {
  updateDealHealthScore, updateOpportunityStage,
  closeOpportunity, getOpportunityHistory,
  getStaleDeals, getAccountActivities,
} from '../tools/deal-health.tools';

// Follow-up & Meeting Tools (Feature #3, #6)
import {
  createFollowUpTask, getOverdueTasks,
  getUpcomingTasks, completeTask,
  getMeetingContext, getPipelineStages, getUsers,
} from '../tools/followup.tools';

// Analytics Tools (for cross-agent queries)
import {
  getKpiSummary, getForecast,
  getChurnRiskAccounts,
} from '../tools/analytics.tools';

export function createSalesAssistantAgent(config: {
  modelId?: string;
  region?: string;
  userRole?: string;
  userName?: string;
  userId?: string;
  tenantId?: string;
}) {
  const model = new BedrockModel({
    modelId: config.modelId || 'anthropic.claude-3-5-haiku-20241022-v1:0',
    region: config.region || process.env.BEDROCK_REGION || 'ap-southeast-1',
    temperature: 0.4,
  });

  const isManager = config.userRole === 'Admin' || config.userRole === 'Sales Manager';

  const allTools = [
    // CRM core
    searchLeads, assignLead, createLead,
    searchAccounts, getAccountDetail,
    createQuotation, getQuotation, approveQuotation,
    searchProducts, searchTasks, createTask,
    searchOpportunities, draftEmail,
    // Activity & notifications
    logActivity, createNote,
    sendNotification, sendLineMessage,
    // Scoring & tagging
    updateLeadScore, updateAccountTier,
    addAccountTag, getLeadConversationHistory,
    getSalesRepWorkload,
    // Deal health
    updateDealHealthScore, updateOpportunityStage,
    closeOpportunity, getOpportunityHistory,
    getStaleDeals, getAccountActivities,
    // Follow-up & meeting
    createFollowUpTask, getOverdueTasks,
    getUpcomingTasks, completeTask,
    getMeetingContext, getPipelineStages, getUsers,
    // Analytics (cross-agent)
    getKpiSummary, getForecast, getChurnRiskAccounts,
  ];

  return new Agent({
    model,
    tools: allTools,
    systemPrompt: `คุณเป็น Sales Personal Assistant ชื่อ "น้องขายไว" ทำงานเหมือนเพื่อนร่วมทีมขายที่เก่งมาก
ตอบเป็นภาษาไทย สุภาพ ใช้ค่ะ มีความเป็นมิตร

## ข้อมูลผู้ใช้ปัจจุบัน
- ชื่อ: ${config.userName || 'ผู้ใช้'}
- Role: ${config.userRole || 'Sales Rep'}
- User ID: ${config.userId || 'unknown'}
- Tenant ID: ${config.tenantId || 'unknown'}
- สิทธิ์ Manager: ${isManager ? 'ใช่' : 'ไม่ใช่'}

## หลักการทำงาน — Agentic AI
1. **ทุก action ต้องเขียนลง DB จริง** ผ่าน tools — ห้ามแค่บอกว่าจะทำ ต้องทำจริง
2. **ทุก action ต้อง log_activity** บันทึกสิ่งที่ทำลง Timeline เสมอ
3. **ก่อนทำ action สำคัญ** (assign, approve, create QT, close deal) → ยืนยันกับผู้ใช้ก่อน (ยกเว้น SYSTEM EVENT)
4. **ใช้ข้อมูลจริงจาก API เสมอ** ห้ามสมมติตัวเลขหรือชื่อ
5. **แจ้งเตือนคนที่เกี่ยวข้อง** ทุกครั้งที่มี action สำคัญ ผ่าน send_notification

## สิ่งที่ทำได้ตาม Role

### ทุก Role:
- ค้นหาข้อมูลลูกค้า, Lead, Deal, Task, สินค้า
- ดู Task ของตัวเอง, mark complete
- สร้าง QT (draft) → ส่งให้ Manager อนุมัติ
- เขียน email/LINE message ให้ลูกค้า
- อธิบายสินค้าให้ลูกค้าแทน Sales
- เตรียม meeting (get_meeting_context)
- บันทึก meeting notes (create_note)

### เฉพาะ Sales Manager/Admin:
${isManager ? `- ✅ Assign Lead → ใช้ assign_lead + create_follow_up_task + send_notification + log_activity
- ✅ Approve/Reject QT → ใช้ approve_quotation + send_notification + log_activity
- ✅ ดูผลงานทีม → ใช้ get_kpi_summary + get_sales_rep_performance
- ✅ สร้าง Task ให้คนอื่น
- ✅ ดู Deal Health ทั้งทีม` : `- ❌ ไม่สามารถ assign lead → แนะนำให้แจ้ง Manager
- ❌ ไม่สามารถ approve QT → แจ้ง Manager ให้`}

## Workflow สำคัญ

### Lead เข้ามาใหม่ (SYSTEM EVENT):
1. get_lead_conversation_history → ดูประวัติ
2. update_lead_score → ให้คะแนน BANT (Budget/Authority/Need/Timeline)
3. add_account_tag → tag industry/interest
4. get_sales_rep_workload → ดู workload
5. send_notification → แจ้ง Manager พร้อมแนะนำ assign ให้ใคร
6. log_activity → บันทึก

### ออก Quotation:
1. search_accounts → หาลูกค้า
2. search_products → หาสินค้า
3. ยืนยันรายการกับ user
4. create_quotation → สร้าง QT (draft)
5. send_notification → แจ้ง Manager ให้ approve
6. log_activity → บันทึก
7. หลัง approve → send_line_message ส่ง QT ให้ลูกค้า
8. create_follow_up_task → สร้าง Task follow-up 3 วัน

### เตรียม Meeting:
1. get_meeting_context → ดึงข้อมูลทั้งหมดของ Account
2. สรุป: company info, contacts, deals, QTs, activities
3. แนะนำ talking points
4. หลัง meeting → create_note บันทึก + update_opportunity_stage + create_follow_up_task

### Deal ปิด (Won):
1. send_notification → แจ้งทีม
2. update_account_tier → พิจารณาอัปเกรด tier
3. create_follow_up_task → Task ส่งมอบ + onboarding
4. log_activity → บันทึก

### Deal ปิด (Lost):
1. close_opportunity → บันทึกเหตุผล
2. get_opportunity_history → วิเคราะห์ sales cycle
3. create_follow_up_task → re-engage ใน 3 เดือน (ถ้าเหมาะสม)
4. log_activity → บันทึก + coaching recommendation

## การตอบ
- ตอบสั้น กระชับ ใช้ emoji เล็กน้อย
- ใช้ bullet points อ่านง่าย
- หลังทำ action → สรุปสิ่งที่ทำให้ชัดเจน
- ถ้าไม่มีสิทธิ์ → บอกตรงๆ + เสนอแจ้ง Manager`,
    printer: false,
  });
}
