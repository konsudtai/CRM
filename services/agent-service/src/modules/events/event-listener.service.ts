/**
 * Event Listener — Listens to SQS events from other services
 * and triggers น้องขายไว proactive actions.
 *
 * Events handled:
 * - lead.created → Score lead + notify Manager to assign
 * - lead.assigned → Notify Rep + create follow-up Task
 * - task.overdue → Remind owner + notify Manager
 * - quotation.finalized → Notify Manager to approve
 * - quotation.status_changed → Notify Rep (approved/rejected)
 * - opportunity.stage_changed → Notify Rep + recommend next action
 * - opportunity.closed → Win/Loss analysis + create delivery Task
 */
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { ChatService } from '../chat/chat.service';

interface DomainEvent {
  eventType: string;
  tenantId: string;
  entityId: string;
  entityType: string;
  data: Record<string, any>;
  userId?: string;
  timestamp: string;
}

@Injectable()
export class EventListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventListenerService.name);
  private readonly sqs: SQSClient;
  private readonly queueUrl: string;
  private polling = false;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(private readonly chatService: ChatService) {
    this.sqs = new SQSClient({
      region: process.env.AWS_REGION || 'ap-southeast-1',
      ...(process.env.SQS_ENDPOINT ? { endpoint: process.env.SQS_ENDPOINT } : {}),
    });
    // Listen to all service queues — each service publishes to its own queue
    this.queueUrl = process.env.SQS_AGENT_QUEUE_URL || 'http://localhost:4566/000000000000/agent-events';
  }

  private get allQueueUrls(): string[] {
    // In production: listen only to the dedicated agent-events queue (fan-out from SNS)
    // In dev: can listen to individual service queues directly
    if (process.env.SQS_AGENT_QUEUE_URL) {
      return [process.env.SQS_AGENT_QUEUE_URL];
    }
    return [
      process.env.SQS_CRM_QUEUE_URL || 'http://localhost:4566/000000000000/crm-events',
      process.env.SQS_SALES_QUEUE_URL || 'http://localhost:4566/000000000000/sales-events',
      process.env.SQS_QUOTATION_QUEUE_URL || 'http://localhost:4566/000000000000/quotation-events',
    ];
  }

  onModuleInit() {
    if (process.env.ENABLE_EVENT_LISTENER !== 'false') {
      this.startPolling();
    }
  }

  onModuleDestroy() {
    this.stopPolling();
  }

  private startPolling() {
    this.polling = true;
    this.logger.log(`Event listener started. Queues: ${this.allQueueUrls.length}`);
    for (const url of this.allQueueUrls) {
      this.pollQueue(url);
    }
  }

  private stopPolling() {
    this.polling = false;
    if (this.pollTimer) clearTimeout(this.pollTimer);
  }

  private async pollQueue(queueUrl: string) {
    if (!this.polling) return;

    try {
      const response = await this.sqs.send(new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
      }));

      if (response.Messages) {
        for (const msg of response.Messages) {
          try {
            const event: DomainEvent = JSON.parse(msg.Body || '{}');
            await this.handleEvent(event);
            await this.sqs.send(new DeleteMessageCommand({
              QueueUrl: queueUrl,
              ReceiptHandle: msg.ReceiptHandle,
            }));
          } catch (err: any) {
            this.logger.error(`Event processing error: ${err.message}`, err.stack);
          }
        }
      }
    } catch (err: any) {
      if (!err.message?.includes('does not exist')) {
        this.logger.error(`SQS poll error (${queueUrl}): ${err.message}`);
      }
    }

    if (this.polling) {
      setTimeout(() => this.pollQueue(queueUrl), 1000);
    }
  }

  private async handleEvent(event: DomainEvent) {
    this.logger.log(`Event: ${event.eventType} entity=${event.entityId} tenant=${event.tenantId}`);

    switch (event.eventType) {
      case 'lead.created':
        return this.onLeadCreated(event);
      case 'lead.assigned':
        return this.onLeadAssigned(event);
      case 'task.overdue':
        return this.onTaskOverdue(event);
      case 'task.created':
        return this.onTaskCreated(event);
      case 'quotation.finalized':
        return this.onQuotationFinalized(event);
      case 'quotation.status_changed':
        return this.onQuotationStatusChanged(event);
      case 'opportunity.stage_changed':
        return this.onOpportunityStageChanged(event);
      case 'opportunity.closed':
        return this.onOpportunityClosed(event);
      default:
        this.logger.debug(`Unhandled event: ${event.eventType}`);
    }
  }

  /**
   * Lead Created → Score + Notify Manager to assign
   */
  private async onLeadCreated(event: DomainEvent) {
    const prompt = `[SYSTEM EVENT: lead.created]
Lead ใหม่เข้ามาในระบบ:
- Lead ID: ${event.entityId}
- Tenant ID: ${event.tenantId}
- ข้อมูล: ${JSON.stringify(event.data)}

กรุณาทำตามขั้นตอน:
1. ใช้ get_lead_conversation_history ดูประวัติ conversation (ถ้ามี)
2. ใช้ get_sales_rep_workload ดู workload ของ Sales Rep แต่ละคน
3. วิเคราะห์และให้คะแนน Lead (AI Score) ด้วย update_lead_score
4. ถ้ามีข้อมูลบริษัท ให้ add_account_tag ตาม industry/interest
5. ใช้ send_notification แจ้ง Sales Manager ทุกคนว่ามี Lead ใหม่ พร้อมแนะนำว่าควร assign ให้ใคร
6. ใช้ log_activity บันทึกว่า "น้องขายไว วิเคราะห์ Lead ใหม่ Score X/100"`;

    await this.chatService.chat({
      message: prompt,
      agentType: 'sales-assistant',
      tenantId: event.tenantId,
      userId: 'system',
      userRole: 'Admin',
    });
  }

  /**
   * Lead Assigned → Notify Rep + Create follow-up Task
   */
  private async onLeadAssigned(event: DomainEvent) {
    const prompt = `[SYSTEM EVENT: lead.assigned]
Lead ถูก assign แล้ว:
- Lead ID: ${event.entityId}
- Assigned to: ${event.data.assignedTo}
- Tenant ID: ${event.tenantId}
- ข้อมูล Lead: ${JSON.stringify(event.data)}

กรุณาทำ:
1. ใช้ send_notification แจ้ง Sales Rep (userId: ${event.data.assignedTo}) ว่าได้รับ Lead ใหม่ พร้อมรายละเอียด
2. ใช้ send_line_message ส่ง LINE ให้ Sales Rep ด้วย (ถ้ามี LINE ID)
3. ใช้ create_follow_up_task สร้าง Task "ติดต่อลูกค้าภายใน 24 ชม." priority High ให้ Sales Rep
4. ใช้ log_activity บันทึกว่า "Lead assigned to [ชื่อ Rep]"`;

    await this.chatService.chat({
      message: prompt,
      agentType: 'sales-assistant',
      tenantId: event.tenantId,
      userId: 'system',
      userRole: 'Admin',
    });
  }

  /**
   * Task Overdue → Remind owner + notify Manager
   */
  private async onTaskOverdue(event: DomainEvent) {
    const prompt = `[SYSTEM EVENT: task.overdue]
Task เกินกำหนด:
- Task ID: ${event.entityId}
- Tenant ID: ${event.tenantId}
- ข้อมูล: ${JSON.stringify(event.data)}

กรุณาทำ:
1. ใช้ send_notification แจ้งเจ้าของ Task (userId: ${event.data.assignedTo}) ว่า Task เกินกำหนด
2. ใช้ get_users หา Sales Manager ของ tenant
3. ใช้ send_notification แจ้ง Sales Manager ว่ามี Task เกินกำหนดของทีม
4. ใช้ log_activity บันทึกว่า "น้องขายไว เตือน Task เกินกำหนด"`;

    await this.chatService.chat({
      message: prompt,
      agentType: 'sales-assistant',
      tenantId: event.tenantId,
      userId: 'system',
      userRole: 'Admin',
    });
  }

  /**
   * Task Created → Notify assigned user
   */
  private async onTaskCreated(event: DomainEvent) {
    if (event.data.assignedTo) {
      const prompt = `[SYSTEM EVENT: task.created]
Task ใหม่ถูกสร้าง:
- Task ID: ${event.entityId}
- Title: ${event.data.title}
- Assigned to: ${event.data.assignedTo}
- Due: ${event.data.dueDate}
- Priority: ${event.data.priority}
- Tenant ID: ${event.tenantId}

ใช้ send_notification แจ้ง user (userId: ${event.data.assignedTo}) ว่ามี Task ใหม่ assign ให้`;

      await this.chatService.chat({
        message: prompt,
        agentType: 'sales-assistant',
        tenantId: event.tenantId,
        userId: 'system',
        userRole: 'Admin',
      });
    }
  }

  /**
   * Quotation Finalized → Notify Manager to approve
   */
  private async onQuotationFinalized(event: DomainEvent) {
    const prompt = `[SYSTEM EVENT: quotation.finalized]
QT ถูกส่งเพื่อขออนุมัติ:
- QT ID: ${event.entityId}
- QT Number: ${event.data.quotationNumber}
- Account: ${event.data.accountName || event.data.accountId}
- Grand Total: ${event.data.grandTotal}
- Created by: ${event.data.createdBy}
- Tenant ID: ${event.tenantId}

กรุณาทำ:
1. ใช้ get_users หา Sales Manager ทุกคน
2. ใช้ send_notification แจ้ง Sales Manager ทุกคนว่ามี QT รออนุมัติ พร้อมรายละเอียด
3. ใช้ log_activity บันทึกว่า "QT ${event.data.quotationNumber} ส่งขออนุมัติ"`;

    await this.chatService.chat({
      message: prompt,
      agentType: 'sales-assistant',
      tenantId: event.tenantId,
      userId: 'system',
      userRole: 'Admin',
    });
  }

  /**
   * Quotation Status Changed → Notify creator
   */
  private async onQuotationStatusChanged(event: DomainEvent) {
    const prompt = `[SYSTEM EVENT: quotation.status_changed]
QT เปลี่ยนสถานะ:
- QT ID: ${event.entityId}
- QT Number: ${event.data.quotationNumber}
- Old Status: ${event.data.oldStatus}
- New Status: ${event.data.newStatus}
- Approved/Rejected by: ${event.data.approvedBy || 'N/A'}
- Created by: ${event.data.createdBy}
- Tenant ID: ${event.tenantId}

กรุณาทำ:
1. ใช้ send_notification แจ้งผู้สร้าง QT (userId: ${event.data.createdBy}) ว่า QT ถูก ${event.data.newStatus}
2. ถ้า approved: แนะนำว่าจะส่ง QT ให้ลูกค้าผ่าน LINE ไหม + สร้าง follow-up Task 3 วัน
3. ถ้า rejected: แจ้งเหตุผล (ถ้ามี) + แนะนำแก้ไข
4. ใช้ log_activity บันทึกการเปลี่ยนสถานะ`;

    await this.chatService.chat({
      message: prompt,
      agentType: 'sales-assistant',
      tenantId: event.tenantId,
      userId: 'system',
      userRole: 'Admin',
    });
  }

  /**
   * Opportunity Stage Changed → Notify + recommend next action
   */
  private async onOpportunityStageChanged(event: DomainEvent) {
    const prompt = `[SYSTEM EVENT: opportunity.stage_changed]
Deal เปลี่ยน stage:
- Opportunity ID: ${event.entityId}
- Deal Name: ${event.data.dealName}
- Old Stage: ${event.data.oldStage}
- New Stage: ${event.data.newStage}
- Value: ${event.data.estimatedValue}
- Assigned to: ${event.data.assignedTo}
- Tenant ID: ${event.tenantId}

กรุณาทำ:
1. ใช้ send_notification แจ้ง Sales Rep (userId: ${event.data.assignedTo})
2. ใช้ send_notification แจ้ง Sales Manager ด้วย
3. วิเคราะห์ว่า stage ใหม่ควรทำอะไรต่อ:
   - Contacted → แนะนำ: qualify ลูกค้า ถามงบ/timeline
   - Qualified → แนะนำ: เตรียม proposal/demo
   - Proposal → แนะนำ: ส่ง QT + นัด meeting
   - Negotiation → แนะนำ: เตรียม final price + ปิด deal
4. ใช้ create_follow_up_task สร้าง Task ตาม recommendation
5. ใช้ log_activity บันทึกการเปลี่ยน stage`;

    await this.chatService.chat({
      message: prompt,
      agentType: 'sales-assistant',
      tenantId: event.tenantId,
      userId: 'system',
      userRole: 'Admin',
    });
  }

  /**
   * Opportunity Closed → Win/Loss analysis
   */
  private async onOpportunityClosed(event: DomainEvent) {
    const isWon = event.data.outcome === 'won';
    const prompt = `[SYSTEM EVENT: opportunity.closed]
Deal ปิดแล้ว — ${isWon ? 'WON 🎉' : 'LOST'}:
- Opportunity ID: ${event.entityId}
- Deal Name: ${event.data.dealName}
- Value: ${event.data.estimatedValue}
- Outcome: ${event.data.outcome}
- Reason: ${event.data.closedReason || 'ไม่ระบุ'}
- Assigned to: ${event.data.assignedTo}
- Tenant ID: ${event.tenantId}

กรุณาทำ:
${isWon ? `
1. ใช้ send_notification แจ้งทั้งทีมว่าปิด Deal สำเร็จ
2. ใช้ get_opportunity_history วิเคราะห์ sales cycle
3. ใช้ create_follow_up_task สร้าง Task "ส่งมอบ + onboarding" ให้ Sales Rep
4. ใช้ update_account_tier พิจารณาอัปเกรด tier ของ Account
5. ใช้ log_activity บันทึก "Deal Won — ฿${event.data.estimatedValue}"
` : `
1. ใช้ send_notification แจ้ง Sales Rep + Manager
2. ใช้ get_opportunity_history วิเคราะห์ว่าแพ้ตรง stage ไหน
3. ใช้ log_activity บันทึก "Deal Lost — ${event.data.closedReason}"
4. ใช้ create_follow_up_task สร้าง Task "re-engage ใน 3 เดือน" ถ้าเหตุผลไม่ใช่ "ไม่ต้องการแล้ว"
5. วิเคราะห์และให้ coaching recommendation สำหรับ Sales Rep
`}`;

    await this.chatService.chat({
      message: prompt,
      agentType: 'sales-assistant',
      tenantId: event.tenantId,
      userId: 'system',
      userRole: 'Admin',
    });
  }
}
