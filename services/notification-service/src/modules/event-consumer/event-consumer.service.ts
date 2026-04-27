import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Message } from '@aws-sdk/client-sqs';
import { DomainEvent, EVENT_TYPES } from '@thai-smb-crm/shared-types';
import { SqsProvider } from '../../providers/sqs.provider';
import { NotificationsService } from '../notifications/notifications.service';
import { WebhooksService } from '../webhooks/webhooks.service';

/**
 * Consumes DomainEvent messages from SQS and dispatches
 * notifications (LINE, email, in-app) and webhook events.
 */
@Injectable()
export class EventConsumerService implements OnModuleInit {
  private readonly logger = new Logger(EventConsumerService.name);

  constructor(
    private readonly sqsProvider: SqsProvider,
    private readonly notificationsService: NotificationsService,
    private readonly webhooksService: WebhooksService,
  ) {}

  onModuleInit(): void {
    this.sqsProvider.registerHandler(this.handleMessage.bind(this));
    this.logger.log('Event consumer registered with SQS provider');
  }

  /**
   * Parse and route an incoming SQS message containing a DomainEvent.
   */
  async handleMessage(message: Message): Promise<void> {
    if (!message.Body) {
      this.logger.warn('Received SQS message with empty body');
      return;
    }

    let event: DomainEvent;
    try {
      event = JSON.parse(message.Body) as DomainEvent;
    } catch {
      this.logger.error('Failed to parse SQS message body as DomainEvent');
      return;
    }

    this.logger.log(
      `Processing event: ${event.eventType} (${event.eventId}) for tenant ${event.tenantId}`,
    );

    // Dispatch notification based on event type
    await this.dispatchNotification(event);

    // Fire webhook events for all domain events
    await this.dispatchWebhook(event);
  }

  /**
   * Map domain events to user-facing notifications.
   */
  private async dispatchNotification(event: DomainEvent): Promise<void> {
    try {
      switch (event.eventType) {
        case EVENT_TYPES.LEAD_ASSIGNED: {
          const assignedTo = event.payload.assignedTo as string;
          const leadName = event.payload.leadName as string || 'Unknown';
          await this.notificationsService.send(
            event.tenantId,
            assignedTo || event.userId,
            'line',
            'lead_assigned',
            'New Lead Assigned',
            `Lead "${leadName}" has been assigned to you.`,
            { ...event.payload, eventId: event.eventId },
          );
          break;
        }

        case EVENT_TYPES.TASK_OVERDUE: {
          const assignee = event.payload.assignedTo as string;
          const taskTitle = event.payload.title as string || 'Untitled';
          await this.notificationsService.send(
            event.tenantId,
            assignee || event.userId,
            'line',
            'task_overdue',
            'Task Overdue',
            `Task "${taskTitle}" is past its due date.`,
            { ...event.payload, eventId: event.eventId },
          );
          break;
        }

        case EVENT_TYPES.OPPORTUNITY_STAGE_CHANGED: {
          const owner = event.payload.assignedTo as string;
          const dealName = event.payload.dealName as string || 'Unknown';
          const newStage = event.payload.newStage as string || '';
          await this.notificationsService.send(
            event.tenantId,
            owner || event.userId,
            'in_app',
            'deal_stage_changed',
            'Deal Stage Changed',
            `Deal "${dealName}" moved to stage "${newStage}".`,
            { ...event.payload, eventId: event.eventId },
          );
          break;
        }

        case EVENT_TYPES.QUOTATION_SENT: {
          await this.notificationsService.send(
            event.tenantId,
            event.userId,
            'in_app',
            'quotation_sent',
            'Quotation Sent',
            `Quotation ${event.payload.quotationNumber || ''} has been sent.`,
            { ...event.payload, eventId: event.eventId },
          );
          break;
        }

        default:
          // Not all events require a notification
          this.logger.debug(`No notification mapping for event type: ${event.eventType}`);
          break;
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to dispatch notification for event ${event.eventId}: ${error.message}`,
      );
    }
  }

  /**
   * Forward domain events to the webhook system for external dispatch.
   */
  private async dispatchWebhook(event: DomainEvent): Promise<void> {
    try {
      // Derive entity type from event type (e.g., "lead.assigned" → "lead")
      const entityType = event.eventType.split('.')[0];
      await this.webhooksService.fireEvent(
        event.tenantId,
        entityType,
        event.eventType,
        {
          ...event.payload,
          eventId: event.eventId,
          userId: event.userId,
          timestamp: event.timestamp,
          version: event.version,
        },
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to dispatch webhook for event ${event.eventId}: ${error.message}`,
      );
    }
  }
}
