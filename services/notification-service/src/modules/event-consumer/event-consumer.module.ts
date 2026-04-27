import { Module } from '@nestjs/common';
import { EventConsumerService } from './event-consumer.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { SqsProvider } from '../../providers/sqs.provider';

@Module({
  imports: [NotificationsModule, WebhooksModule],
  providers: [EventConsumerService, SqsProvider],
  exports: [EventConsumerService],
})
export class EventConsumerModule {}
