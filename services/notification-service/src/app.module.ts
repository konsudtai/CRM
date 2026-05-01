import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Notification } from './entities/notification.entity';
import { WebhookConfig } from './entities/webhook-config.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { RedisProvider, REDIS_CLIENT } from './providers/redis.provider';
import { SqsProvider } from './providers/sqs.provider';
import { LineModule } from './modules/line/line.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { EventConsumerModule } from './modules/event-consumer/event-consumer.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'notification_service',
      entities: [Notification, WebhookConfig, WebhookDelivery],
      migrations: [],
      synchronize: false,
      logging: process.env.DB_LOGGING === 'true',
    }),
    JwtModule.register({
      secret: (() => { const s = process.env.JWT_SECRET; if (!s) throw new Error('JWT_SECRET env var is required'); return s; })(),
      signOptions: { expiresIn: '1h' },
    }),
    LineModule,
    NotificationsModule,
    WebhooksModule,
    EventConsumerModule,
  ],
  providers: [RedisProvider, SqsProvider],
  exports: [REDIS_CLIENT, SqsProvider],
})
export class AppModule {}
