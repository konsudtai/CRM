import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
} from '@aws-sdk/client-sqs';

export const SQS_PROVIDER = 'SQS_PROVIDER';

export interface SqsMessageHandler {
  (message: Message): Promise<void>;
}

/**
 * SQS provider that polls messages from a configurable queue URL.
 * Processes messages one at a time and deletes them after successful handling.
 */
@Injectable()
export class SqsProvider implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SqsProvider.name);
  private readonly client: SQSClient;
  private readonly queueUrl: string;
  private polling = false;
  private handler: SqsMessageHandler | null = null;

  constructor() {
    this.client = new SQSClient({
      region: process.env.AWS_REGION || 'ap-southeast-7',
      ...(process.env.SQS_ENDPOINT
        ? { endpoint: process.env.SQS_ENDPOINT }
        : {}),
    });
    this.queueUrl =
      process.env.SQS_QUEUE_URL || 'http://localhost:4566/000000000000/notifications';
  }

  /**
   * Register a handler for incoming SQS messages.
   */
  registerHandler(handler: SqsMessageHandler): void {
    this.handler = handler;
  }

  async onModuleInit(): Promise<void> {
    if (process.env.SQS_POLLING_ENABLED !== 'false') {
      this.startPolling();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopPolling();
  }

  private startPolling(): void {
    this.polling = true;
    this.logger.log(`Starting SQS polling on queue: ${this.queueUrl}`);
    this.poll();
  }

  private stopPolling(): void {
    this.polling = false;
    this.logger.log('Stopping SQS polling');
  }

  private async poll(): Promise<void> {
    while (this.polling) {
      try {
        const response = await this.client.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
            MessageAttributeNames: ['All'],
          }),
        );

        if (response.Messages && response.Messages.length > 0) {
          for (const message of response.Messages) {
            await this.processMessage(message);
          }
        }
      } catch (error) {
        this.logger.error('Error polling SQS queue', error);
        // Back off on error before retrying
        await this.sleep(5000);
      }
    }
  }

  private async processMessage(message: Message): Promise<void> {
    try {
      if (this.handler) {
        await this.handler(message);
      } else {
        this.logger.warn('No handler registered for SQS messages');
      }

      // Delete message after successful processing
      if (message.ReceiptHandle) {
        await this.client.send(
          new DeleteMessageCommand({
            QueueUrl: this.queueUrl,
            ReceiptHandle: message.ReceiptHandle,
          }),
        );
      }
    } catch (error) {
      this.logger.error(
        `Error processing SQS message ${message.MessageId}`,
        error,
      );
      // Message will become visible again after visibility timeout
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
