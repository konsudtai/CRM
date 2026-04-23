import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../entities/notification.entity';

export interface LineChannelConfig {
  tenantId: string;
  channelAccessToken: string;
  channelSecret: string;
}

export interface LineSendResult {
  success: boolean;
  attempts: number;
  error?: string;
}

@Injectable()
export class LineService {
  private readonly logger = new Logger(LineService.name);
  private readonly LINE_API_URL = 'https://api.line.me/v2/bot/message/push';
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY_MS = 1000;

  /** In-memory store for tenant LINE configs. In production, use DB/Redis. */
  private configs = new Map<string, LineChannelConfig>();

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  configureChannel(config: LineChannelConfig): void {
    this.configs.set(config.tenantId, config);
    this.logger.log(`LINE channel configured for tenant ${config.tenantId}`);
  }

  getConfig(tenantId: string): LineChannelConfig | undefined {
    return this.configs.get(tenantId);
  }

  /**
   * Send a push message via LINE Messaging API with retry logic.
   * Retries up to 3 times with exponential backoff (1s, 2s, 4s).
   */
  async sendPushMessage(
    tenantId: string,
    recipientLineId: string,
    messages: Array<{ type: string; text?: string; originalContentUrl?: string; previewImageUrl?: string }>,
  ): Promise<LineSendResult> {
    const config = this.configs.get(tenantId);
    if (!config) {
      return { success: false, attempts: 0, error: 'LINE channel not configured for tenant' };
    }

    let lastError: string | undefined;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const response = await this.callLineApi(config.channelAccessToken, recipientLineId, messages);

        if (response.ok) {
          await this.logMessage(tenantId, recipientLineId, messages, 'delivered', attempt + 1);
          return { success: true, attempts: attempt + 1 };
        }

        const body = await response.text();
        lastError = `LINE API error: ${response.status} - ${body}`;
        this.logger.warn(`LINE API attempt ${attempt + 1} failed: ${lastError}`);
      } catch (err: any) {
        lastError = err.message || 'Unknown error';
        this.logger.warn(`LINE API attempt ${attempt + 1} exception: ${lastError}`);
      }

      // Exponential backoff: 1s, 2s, 4s
      if (attempt < this.MAX_RETRIES - 1) {
        const delay = this.calculateBackoffDelay(attempt, this.BASE_DELAY_MS);
        await this.sleep(delay);
      }
    }

    await this.logMessage(tenantId, recipientLineId, messages, 'failed', this.MAX_RETRIES, lastError);
    return { success: false, attempts: this.MAX_RETRIES, error: lastError };
  }

  /**
   * Calculate exponential backoff delay: base_delay * 2^attempt
   */
  calculateBackoffDelay(attempt: number, baseDelay: number): number {
    return baseDelay * Math.pow(2, attempt);
  }

  /** Send a quotation PDF via LINE message */
  async sendQuotationPdf(
    tenantId: string,
    recipientLineId: string,
    pdfUrl: string,
    quotationNumber: string,
  ): Promise<LineSendResult> {
    return this.sendPushMessage(tenantId, recipientLineId, [
      { type: 'text', text: `ใบเสนอราคา ${quotationNumber}` },
      { type: 'text', text: `ดาวน์โหลด: ${pdfUrl}` },
    ]);
  }

  /** Handle incoming webhook from LINE (customer messages) */
  async handleIncomingWebhook(
    tenantId: string,
    events: Array<{ type: string; source?: { userId?: string }; message?: { type: string; text?: string }; timestamp?: number }>,
  ): Promise<void> {
    for (const event of events) {
      if (event.type === 'message' && event.source?.userId) {
        await this.logMessage(
          tenantId,
          event.source.userId,
          [{ type: event.message?.type || 'unknown', text: event.message?.text }],
          'delivered',
          1,
        );
        this.logger.log(`Incoming LINE message from ${event.source.userId} for tenant ${tenantId}`);
      }
    }
  }

  private async callLineApi(
    token: string,
    to: string,
    messages: Array<Record<string, unknown>>,
  ): Promise<Response> {
    return fetch(this.LINE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to, messages }),
    });
  }

  private async logMessage(
    tenantId: string,
    recipient: string,
    messages: Array<Record<string, unknown>>,
    status: string,
    attempts: number,
    error?: string,
  ): Promise<void> {
    try {
      const notification = this.notificationRepo.create({
        tenantId,
        userId: recipient,
        channel: 'line',
        type: 'line_message',
        title: 'LINE Message',
        body: JSON.stringify(messages),
        metadata: { recipient, error },
        status,
        retryCount: attempts,
        sentAt: status === 'delivered' ? new Date() : null,
      });
      await this.notificationRepo.save(notification);
    } catch (err) {
      this.logger.error('Failed to log LINE message', err);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
