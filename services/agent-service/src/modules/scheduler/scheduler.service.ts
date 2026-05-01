/**
 * Scheduler Service — Proactive cron jobs for น้องขายไว
 *
 * Feature #5: Deal Health Monitoring (daily)
 * Feature #9: Proactive Daily Digest (every morning)
 */
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ChatService } from '../chat/chat.service';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(private readonly chatService: ChatService) {}

  onModuleInit() {
    if (process.env.ENABLE_SCHEDULER !== 'false') {
      this.scheduleDailyDigest();
      this.scheduleDealHealthCheck();
      this.scheduleTaskReminders();
      this.logger.log('Scheduler started — daily digest, deal health, task reminders');
    }
  }

  onModuleDestroy() {
    this.timers.forEach(t => clearTimeout(t));
    this.timers.forEach(t => clearInterval(t));
  }

  /**
   * Daily Digest — ทุกเช้า 8:30 (หรือทุก 24 ชม. ใน dev)
   */
  private scheduleDailyDigest() {
    const runDigest = async () => {
      this.logger.log('Running daily digest...');
      try {
        const tenants = await this.getActiveTenants();
        for (const tenantId of tenants) {
          await this.runDailyDigestForTenant(tenantId);
        }
      } catch (err: any) {
        this.logger.error(`Daily digest error: ${err.message}`);
      }
    };

    // In production: schedule at 8:30 AM Bangkok time
    // In dev: run every 24 hours from startup
    const intervalMs = 24 * 60 * 60 * 1000;
    const now = new Date();
    const targetHour = 8;
    const targetMinute = 30;
    const bangkokOffset = 7 * 60; // UTC+7

    let nextRun = new Date(now);
    nextRun.setUTCHours(targetHour - 7, targetMinute, 0, 0); // Convert Bangkok to UTC
    if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);

    const delayMs = nextRun.getTime() - now.getTime();
    this.logger.log(`Daily digest scheduled in ${Math.round(delayMs / 60000)} minutes`);

    const timer = setTimeout(() => {
      runDigest();
      const interval = setInterval(runDigest, intervalMs);
      this.timers.push(interval as any);
    }, delayMs);
    this.timers.push(timer);
  }

  /**
   * Deal Health Check — ทุก 6 ชม.
   */
  private scheduleDealHealthCheck() {
    const runHealthCheck = async () => {
      this.logger.log('Running deal health check...');
      try {
        const tenants = await this.getActiveTenants();
        for (const tenantId of tenants) {
          await this.runDealHealthCheckForTenant(tenantId);
        }
      } catch (err: any) {
        this.logger.error(`Deal health check error: ${err.message}`);
      }
    };

    const interval = setInterval(runHealthCheck, 6 * 60 * 60 * 1000);
    this.timers.push(interval as any);
  }

  /**
   * Task Reminders — ทุก 1 ชม. เช็ค Task ที่ใกล้ครบกำหนด
   */
  private scheduleTaskReminders() {
    const runReminders = async () => {
      try {
        const tenants = await this.getActiveTenants();
        for (const tenantId of tenants) {
          await this.runTaskRemindersForTenant(tenantId);
        }
      } catch (err: any) {
        this.logger.error(`Task reminder error: ${err.message}`);
      }
    };

    const interval = setInterval(runReminders, 60 * 60 * 1000);
    this.timers.push(interval as any);
  }

  /**
   * Daily Digest for a single tenant
   */
  private async runDailyDigestForTenant(tenantId: string) {
    const prompt = `[SYSTEM SCHEDULED: daily_digest]
Tenant ID: ${tenantId}
เวลา: ${new Date().toISOString()}

กรุณาทำ Daily Digest:
1. ใช้ get_users ดึงรายชื่อ user ทั้งหมดของ tenant
2. สำหรับแต่ละ user ที่ active:
   a. ใช้ get_kpi_summary ดึง KPI ของ tenant
   b. ใช้ get_overdue_tasks ดึง Task เกินกำหนดของ user
   c. ใช้ get_upcoming_tasks ดึง Task วันนี้ของ user
   d. ใช้ search_leads ดึง Lead ที่ยังไม่ assign (สำหรับ Manager)
   e. ใช้ get_quotation ดึง QT ที่รออนุมัติ (สำหรับ Manager)

3. สร้าง Daily Digest message ตาม Role:
   - Sales Manager: Lead รอ assign, QT รออนุมัติ, Deal ใกล้ปิด, Task เกินกำหนดของทีม, ยอดเดือนนี้
   - Sales Rep: Lead ที่ assign ให้, งานวันนี้, เกินกำหนด, ยอดของตัวเอง

4. ใช้ send_notification ส่ง Daily Digest ให้แต่ละคน (channel: in_app)
5. ใช้ send_line_message ส่ง LINE ให้ด้วย (ถ้า user มี LINE ID)
6. ใช้ log_activity บันทึกว่า "น้องขายไว ส่ง Daily Digest"`;

    await this.chatService.chat({
      message: prompt,
      agentType: 'sales-assistant',
      tenantId,
      userId: 'system',
      userRole: 'Admin',
    });
  }

  /**
   * Deal Health Check for a single tenant
   */
  private async runDealHealthCheckForTenant(tenantId: string) {
    const prompt = `[SYSTEM SCHEDULED: deal_health_check]
Tenant ID: ${tenantId}
เวลา: ${new Date().toISOString()}

กรุณาตรวจสอบ Deal Health:
1. ใช้ get_stale_deals ดึง Deal ที่อยู่ stage เดิมนานเกินไป
2. ใช้ get_churn_risk_accounts ดึงลูกค้าที่เสี่ยงหาย
3. สำหรับแต่ละ Deal ที่ stale:
   a. ใช้ get_account_activities ดูว่ามี activity ล่าสุดเมื่อไหร่
   b. ใช้ update_deal_health_score อัปเดต health score (green/yellow/red)
   c. ถ้า yellow/red: ใช้ send_notification แจ้ง Sales Rep + Manager
   d. ใช้ create_follow_up_task สร้าง Task follow-up ถ้ายังไม่มี

4. สำหรับลูกค้าที่เสี่ยงหาย:
   a. ใช้ send_notification แจ้ง Sales Rep ที่ดูแล
   b. ใช้ create_follow_up_task สร้าง Task "re-engage ลูกค้า"

5. ใช้ log_activity บันทึกว่า "น้องขายไว ตรวจสอบ Deal Health"`;

    await this.chatService.chat({
      message: prompt,
      agentType: 'sales-assistant',
      tenantId,
      userId: 'system',
      userRole: 'Admin',
    });
  }

  /**
   * Task Reminders for a single tenant
   */
  private async runTaskRemindersForTenant(tenantId: string) {
    const prompt = `[SYSTEM SCHEDULED: task_reminders]
Tenant ID: ${tenantId}
เวลา: ${new Date().toISOString()}

กรุณาเช็ค Task ที่ใกล้ครบกำหนด:
1. ใช้ get_upcoming_tasks ดึง Task ที่ครบกำหนดภายใน 1 วัน
2. สำหรับแต่ละ Task:
   a. ใช้ send_notification แจ้งเจ้าของ Task ว่า "Task ใกล้ครบกำหนดพรุ่งนี้"
3. ใช้ get_overdue_tasks ดึง Task ที่เพิ่งเกินกำหนด (ภายใน 1 ชม.)
4. สำหรับ Task ที่เพิ่งเกินกำหนด:
   a. ใช้ send_notification แจ้งเจ้าของ Task + Manager`;

    await this.chatService.chat({
      message: prompt,
      agentType: 'sales-assistant',
      tenantId,
      userId: 'system',
      userRole: 'Admin',
    });
  }

  /**
   * Get active tenant IDs from auth service
   */
  private async getActiveTenants(): Promise<string[]> {
    try {
      const AUTH_API = process.env.AUTH_API_URL || 'http://localhost:3001';
      const token = process.env.INTERNAL_SERVICE_TOKEN;
      const res = await fetch(`${AUTH_API}/tenants?active=true`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data || []).map((t: any) => t.id);
    } catch {
      return [];
    }
  }
}
