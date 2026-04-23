import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { WebhookConfig } from '../../entities/webhook-config.entity';
import { WebhookDelivery } from '../../entities/webhook-delivery.entity';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY_MS = 5000;

  constructor(
    @InjectRepository(WebhookConfig)
    private readonly configRepo: Repository<WebhookConfig>,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepo: Repository<WebhookDelivery>,
  ) {}

  // --- CRUD ---

  async create(tenantId: string, data: Partial<WebhookConfig>): Promise<WebhookConfig> {
    const config = this.configRepo.create({ ...data, tenantId, isActive: true });
    return this.configRepo.save(config);
  }

  async findAll(tenantId: string): Promise<WebhookConfig[]> {
    return this.configRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async update(id: string, tenantId: string, data: Partial<WebhookConfig>): Promise<WebhookConfig | null> {
    const config = await this.configRepo.findOne({ where: { id, tenantId } });
    if (!config) return null;
    Object.assign(config, data);
    return this.configRepo.save(config);
  }

  async getDeliveryLogs(webhookId: string): Promise<WebhookDelivery[]> {
    return this.deliveryRepo.find({
      where: { webhookId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  // --- Event Firing ---

  /**
   * Fire a webhook event to all matching active configs for a tenant.
   * Filters by entityType AND eventType.
   */
  async fireEvent(
    tenantId: string,
    entityType: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const configs = await this.configRepo.find({
      where: { tenantId, isActive: true },
    });

    const matching = configs.filter(
      (c) => this.matchesFilter(c.entityTypes, entityType) && this.matchesFilter(c.eventTypes, eventType),
    );

    for (const config of matching) {
      // Fire-and-forget with retry
      this.deliverWithRetry(config, eventType, payload).catch((err) =>
        this.logger.error(`Webhook delivery failed for config ${config.id}: ${err.message}`),
      );
    }
  }

  /**
   * Check if a value matches a filter array.
   * Empty filter array means "match all".
   */
  matchesFilter(filterArray: string[], value: string): boolean {
    if (!filterArray || filterArray.length === 0) return true;
    return filterArray.includes(value);
  }

  /**
   * Sign a payload with HMAC-SHA256.
   */
  signPayload(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Calculate exponential backoff delay: base_delay * 2^attempt
   */
  calculateBackoffDelay(attempt: number, baseDelay: number): number {
    return baseDelay * Math.pow(2, attempt);
  }

  /**
   * Deliver a webhook with retry logic (up to 5 attempts, exponential backoff).
   */
  async deliverWithRetry(
    config: WebhookConfig,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<WebhookDelivery> {
    const delivery = this.deliveryRepo.create({
      webhookId: config.id,
      eventType,
      payload,
      status: 'pending',
      attempts: 0,
    });
    const saved = await this.deliveryRepo.save(delivery);

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      saved.attempts = attempt + 1;
      try {
        const bodyStr = JSON.stringify(payload);
        const signature = this.signPayload(bodyStr, config.secret);

        const response = await fetch(config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': eventType,
          },
          body: bodyStr,
        });

        saved.responseStatus = response.status;
        saved.responseBody = await response.text();

        if (response.ok) {
          saved.status = 'success';
          return this.deliveryRepo.save(saved);
        }

        this.logger.warn(
          `Webhook delivery attempt ${attempt + 1} to ${config.url} failed: ${saved.responseStatus}`,
        );
      } catch (err: any) {
        saved.responseBody = err.message;
        this.logger.warn(
          `Webhook delivery attempt ${attempt + 1} to ${config.url} exception: ${err.message}`,
        );
      }

      // Exponential backoff: 5s, 10s, 20s, 40s, 80s
      if (attempt < this.MAX_RETRIES - 1) {
        const delay = this.calculateBackoffDelay(attempt, this.BASE_DELAY_MS);
        saved.nextRetryAt = new Date(Date.now() + delay);
        await this.deliveryRepo.save(saved);
        await this.sleep(delay);
      }
    }

    saved.status = 'failed';
    saved.nextRetryAt = null;
    return this.deliveryRepo.save(saved);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
