import { Injectable, Logger } from '@nestjs/common';
import {
  SQSClient,
  SendMessageCommand,
  SendMessageCommandOutput,
} from '@aws-sdk/client-sqs';
import { v4 as uuidv4 } from 'uuid';
import { DomainEvent } from '@thai-smb-crm/shared-types';

/**
 * Publishes DomainEvent messages to SQS queues.
 * Each service instantiates its own EventBusService with a target queue URL.
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly client: SQSClient;
  private readonly queueUrl: string;

  constructor() {
    this.client = new SQSClient({
      region: process.env.AWS_REGION || 'ap-southeast-1',
      ...(process.env.SQS_ENDPOINT
        ? { endpoint: process.env.SQS_ENDPOINT }
        : {}),
    });
    this.queueUrl =
      process.env.SQS_PUBLISH_QUEUE_URL ||
      'http://localhost:4566/000000000000/crm-events';
  }

  /**
   * Publish a DomainEvent to the configured SQS queue.
   */
  async publish(
    eventType: string,
    tenantId: string,
    userId: string,
    payload: Record<string, unknown>,
    version = 1,
  ): Promise<DomainEvent> {
    const event: DomainEvent = {
      eventId: uuidv4(),
      eventType,
      tenantId,
      userId,
      timestamp: new Date().toISOString(),
      payload,
      version,
    };

    try {
      const result: SendMessageCommandOutput = await this.client.send(
        new SendMessageCommand({
          QueueUrl: this.queueUrl,
          MessageBody: JSON.stringify(event),
          MessageAttributes: {
            eventType: {
              DataType: 'String',
              StringValue: event.eventType,
            },
            tenantId: {
              DataType: 'String',
              StringValue: event.tenantId,
            },
          },
        }),
      );

      this.logger.log(
        `Published event ${event.eventType} (${event.eventId}) → SQS MessageId: ${result.MessageId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to publish event ${event.eventType}: ${error.message}`,
        error.stack,
      );
      // Don't throw — event publishing should not break the main flow
    }

    return event;
  }
}
