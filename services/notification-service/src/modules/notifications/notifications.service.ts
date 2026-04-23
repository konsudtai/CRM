import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { LineService } from '../line/line.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly lineService: LineService,
  ) {}

  async send(
    tenantId: string,
    userId: string,
    channel: 'line' | 'email' | 'in_app',
    type: string,
    title: string,
    body: string,
    metadata: Record<string, unknown> = {},
  ): Promise<Notification> {
    const notification = this.notificationRepo.create({
      tenantId,
      userId,
      channel,
      type,
      title,
      body,
      metadata,
      status: 'pending',
      retryCount: 0,
    });
    const saved = await this.notificationRepo.save(notification);

    // Dispatch based on channel
    try {
      if (channel === 'line') {
        const lineId = (metadata.lineId as string) || userId;
        const result = await this.lineService.sendPushMessage(tenantId, lineId, [
          { type: 'text', text: `${title}\n${body}` },
        ]);
        saved.status = result.success ? 'delivered' : 'failed';
        saved.retryCount = result.attempts;
        saved.sentAt = result.success ? new Date() : null;
      } else if (channel === 'email') {
        // Email stub — mark as sent
        saved.status = 'sent';
        saved.sentAt = new Date();
        this.logger.log(`Email notification stub: ${title} to ${userId}`);
      } else {
        // in_app — mark as delivered immediately
        saved.status = 'delivered';
        saved.sentAt = new Date();
      }
    } catch (err: any) {
      saved.status = 'failed';
      saved.metadata = { ...saved.metadata, error: err.message };
      this.logger.error(`Failed to send notification: ${err.message}`);
    }

    return this.notificationRepo.save(saved);
  }

  async findByTenant(tenantId: string, userId?: string): Promise<Notification[]> {
    const where: Record<string, string> = { tenantId };
    if (userId) where.userId = userId;
    return this.notificationRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async markAsRead(id: string, tenantId: string): Promise<Notification | null> {
    const notification = await this.notificationRepo.findOne({
      where: { id, tenantId },
    });
    if (!notification) return null;
    notification.status = 'delivered';
    notification.metadata = { ...notification.metadata, readAt: new Date().toISOString() };
    return this.notificationRepo.save(notification);
  }
}
