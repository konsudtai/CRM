import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Notification } from '../../entities/notification.entity';

export interface LineChannelConfig {
  tenantId: string;
  channelAccessToken: string;
  channelSecret: string;
  channelName?: string;
  autoCreateLead?: boolean;
  notifySalesRep?: boolean;
  logTimeline?: boolean;
}

export interface LineSendResult {
  success: boolean;
  attempts: number;
  error?: string;
}

@Injectable()
export class LineService {
  private readonly logger = new Logger(LineService.name);
  private readonly LINE_API_BASE = 'https://api.line.me/v2/bot';
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY_MS = 1000;

  /** In-memory config store — production should use DB/Secrets Manager */
  private configs = new Map<string, LineChannelConfig>();

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  // ── Configuration ──────────────────────────────────────────────────────────

  configureChannel(config: LineChannelConfig): void {
    this.configs.set(config.tenantId, config);
    this.logger.log(`LINE channel configured for tenant ${config.tenantId}`);
  }

  getConfig(tenantId: string): LineChannelConfig | undefined {
    return this.configs.get(tenantId);
  }

  isConfigured(tenantId: string): boolean {
    return this.configs.has(tenantId);
  }

  // ── Signature Verification ─────────────────────────────────────────────────

  verifySignature(tenantId: string, body: string, signature: string): boolean {
    const config = this.configs.get(tenantId);
    if (!config) return false;
    const hash = crypto
      .createHmac('sha256', config.channelSecret)
      .update(body)
      .digest('base64');
    return hash === signature;
  }

  // ── Incoming Webhook ───────────────────────────────────────────────────────

  async handleIncomingWebhook(
    tenantId: string,
    events: Array<{
      type: string;
      source?: { userId?: string; type?: string };
      message?: { type: string; text?: string; id?: string };
      timestamp?: number;
      replyToken?: string;
    }>,
  ): Promise<void> {
    const config = this.configs.get(tenantId);

    for (const event of events) {
      if (event.type !== 'message') continue;
      const userId = event.source?.userId;
      if (!userId) continue;

      const text = event.message?.text || '';
      this.logger.log(`LINE message from ${userId}: "${text.slice(0, 50)}"`);

      // 1. Log to notifications table
      await this.logIncoming(tenantId, userId, text);

      // 2. Auto-create lead if configured
      if (config?.autoCreateLead !== false) {
        await this.autoCreateLead(tenantId, userId, text);
      }

      // 3. Auto-reply acknowledgement
      if (event.replyToken && config) {
        await this.replyMessage(config.channelAccessToken, event.replyToken, [
          {
            type: 'text',
            text: 'ขอบคุณที่ติดต่อมาครับ ทีมงานจะติดต่อกลับโดยเร็วที่สุด 🙏',
          },
        ]);
      }
    }
  }

  // ── Auto-create Lead ───────────────────────────────────────────────────────

  private async autoCreateLead(
    tenantId: string,
    lineUserId: string,
    message: string,
  ): Promise<void> {
    try {
      // In production: call sales-service API to create lead
      // For now: log as notification with type 'line_lead'
      const notification = this.notificationRepo.create({
        tenantId,
        userId: lineUserId,
        channel: 'line',
        type: 'line_lead',
        title: 'New Lead from LINE OA',
        body: message.slice(0, 500),
        metadata: {
          lineUserId,
          source: 'LINE OA',
          autoCreated: true,
          stage: 'New',
        },
        status: 'pending',
        retryCount: 0,
      });
      await this.notificationRepo.save(notification);
      this.logger.log(`Auto-created lead for LINE user ${lineUserId}`);
    } catch (err) {
      this.logger.error('Failed to auto-create lead from LINE', err);
    }
  }

  // ── Send Messages ──────────────────────────────────────────────────────────

  async sendPushMessage(
    tenantId: string,
    recipientLineId: string,
    messages: Array<{ type: string; text?: string; [key: string]: unknown }>,
  ): Promise<LineSendResult> {
    const config = this.configs.get(tenantId);
    if (!config) {
      return { success: false, attempts: 0, error: 'LINE not configured for this tenant' };
    }
    return this.pushWithRetry(config.channelAccessToken, recipientLineId, messages);
  }

  /** Send product recommendation via LINE */
  async sendProductRecommendation(
    tenantId: string,
    recipientLineId: string,
    product: { name: string; price: number; sku: string; description?: string },
  ): Promise<LineSendResult> {
    const priceFormatted = new Intl.NumberFormat('th-TH').format(product.price);
    return this.sendPushMessage(tenantId, recipientLineId, [
      {
        type: 'text',
        text: [
          '📦 สินค้าแนะนำ',
          `ชื่อ: ${product.name}`,
          `SKU: ${product.sku}`,
          `ราคา: ฿${priceFormatted}`,
          product.description ? `รายละเอียด: ${product.description}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ]);
  }

  /** Send quotation notification via LINE */
  async sendQuotationNotification(
    tenantId: string,
    recipientLineId: string,
    quotation: {
      number: string;
      grandTotal: number;
      validUntil?: string;
      pdfUrl?: string;
    },
  ): Promise<LineSendResult> {
    const totalFormatted = new Intl.NumberFormat('th-TH').format(quotation.grandTotal);
    const messages: Array<{ type: string; text: string }> = [
      {
        type: 'text',
        text: [
          '📄 ใบเสนอราคา',
          `เลขที่: ${quotation.number}`,
          `มูลค่ารวม: ฿${totalFormatted} (รวม VAT)`,
          quotation.validUntil ? `ใช้ได้ถึง: ${quotation.validUntil}` : '',
          quotation.pdfUrl ? `ดาวน์โหลด PDF: ${quotation.pdfUrl}` : '',
          '\nกรุณาตรวจสอบและยืนยันการสั่งซื้อ',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ];
    return this.sendPushMessage(tenantId, recipientLineId, messages);
  }

  /** Broadcast message to multiple LINE users */
  async broadcastMessage(
    tenantId: string,
    recipientLineIds: string[],
    text: string,
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    for (const lineId of recipientLineIds) {
      const result = await this.sendPushMessage(tenantId, lineId, [{ type: 'text', text }]);
      if (result.success) sent++;
      else failed++;
    }
    return { sent, failed };
  }

  // ── Reply Message ──────────────────────────────────────────────────────────

  private async replyMessage(
    token: string,
    replyToken: string,
    messages: Array<{ type: string; text?: string }>,
  ): Promise<void> {
    try {
      await fetch(`${this.LINE_API_BASE}/message/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ replyToken, messages }),
      });
    } catch (err) {
      this.logger.error('Failed to send LINE reply', err);
    }
  }

  // ── Internal Helpers ───────────────────────────────────────────────────────

  private async pushWithRetry(
    token: string,
    to: string,
    messages: Array<Record<string, unknown>>,
  ): Promise<LineSendResult> {
    let lastError: string | undefined;
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(`${this.LINE_API_BASE}/message/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ to, messages }),
        });
        if (res.ok) return { success: true, attempts: attempt + 1 };
        lastError = `HTTP ${res.status}: ${await res.text()}`;
      } catch (err: any) {
        lastError = err.message;
      }
      if (attempt < this.MAX_RETRIES - 1) {
        await this.sleep(this.BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }
    return { success: false, attempts: this.MAX_RETRIES, error: lastError };
  }

  private async logIncoming(tenantId: string, lineUserId: string, text: string): Promise<void> {
    try {
      const n = this.notificationRepo.create({
        tenantId,
        userId: lineUserId,
        channel: 'line',
        type: 'line_incoming',
        title: 'LINE Message Received',
        body: text.slice(0, 500),
        metadata: { lineUserId, direction: 'inbound' },
        status: 'delivered',
        retryCount: 0,
        sentAt: new Date(),
      });
      await this.notificationRepo.save(n);
    } catch (err) {
      this.logger.error('Failed to log incoming LINE message', err);
    }
  }

  calculateBackoffDelay(attempt: number, baseDelay: number): number {
    return baseDelay * Math.pow(2, attempt);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
