/**
 * AWS Lambda handler for Agent Service.
 *
 * Handles two event sources:
 *   1. API Gateway HTTP events → NestJS (chat, stream, line-webhook)
 *   2. SQS events → Event Listener (proactive agent actions)
 */
import 'reflect-metadata';
import serverlessExpress from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import { AppModule } from './app.module';

let cachedServer: any;
let nestApp: any;

async function bootstrap() {
  if (cachedServer) return { server: cachedServer, app: nestApp };

  const expressApp = express();
  nestApp = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { logger: ['error', 'warn', 'log'] },
  );

  nestApp.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  nestApp.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['*'],
    credentials: true,
  });

  await nestApp.init();
  cachedServer = serverlessExpress({ app: expressApp });
  return { server: cachedServer, app: nestApp };
}

/**
 * Check if the event is from SQS (domain events for proactive agent actions).
 */
function isSqsEvent(event: any): boolean {
  return event?.Records && Array.isArray(event.Records) && event.Records[0]?.eventSource === 'aws:sqs';
}

/**
 * Check if the event is from EventBridge (scheduled actions).
 */
function isScheduledEvent(event: any): boolean {
  return event?.source === 'scheduled' || event?.source === 'aws.events';
}

export const handler = async (event: any, context: any) => {
  const { server, app } = await bootstrap();

  // Scheduled events from EventBridge (daily digest, deal health, task reminders)
  if (isScheduledEvent(event)) {
    const ChatService = (await import('./modules/chat/chat.service')).ChatService;
    const chatService = app.get(ChatService);
    const action = event.action || 'daily_digest';

    console.log(`[Scheduled] Running action: ${action}`);

    // Get active tenants and run the scheduled action for each
    const AUTH_API = process.env.AUTH_API_URL || '';
    let tenants: string[] = ['00000000-0000-0000-0000-000000000001']; // default tenant

    try {
      const token = process.env.INTERNAL_SERVICE_TOKEN;
      const res = await fetch(`${AUTH_API}/tenants?active=true`, {
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          tenants = data.map((t: any) => t.id);
        }
      }
    } catch { /* use default tenant */ }

    for (const tenantId of tenants) {
      try {
        const prompt = `[SYSTEM SCHEDULED: ${action}]\nTenant ID: ${tenantId}\nTime: ${new Date().toISOString()}`;
        await chatService.chat({
          message: prompt,
          agentType: 'sales-assistant',
          tenantId,
          userId: 'system',
          userRole: 'Admin',
        });
      } catch (err: any) {
        console.error(`[Scheduled] Error for tenant ${tenantId}: ${err.message}`);
      }
    }

    return { statusCode: 200, body: `Scheduled action '${action}' completed for ${tenants.length} tenants` };
  }

  // SQS events are handled by the EventListenerService internally
  // (it polls SQS in the background). For Lambda with SQS trigger,
  // we process the records directly via the chat service.
  if (isSqsEvent(event)) {
    const ChatService = (await import('./modules/chat/chat.service')).ChatService;
    const chatService = app.get(ChatService);

    for (const record of event.Records) {
      try {
        const domainEvent = JSON.parse(record.body);
        console.log(`[SQS] Processing event: ${domainEvent.eventType} entity=${domainEvent.entityId}`);

        // Route domain events to the appropriate agent action
        await chatService.chat({
          message: `[SYSTEM EVENT: ${domainEvent.eventType}]\n${JSON.stringify(domainEvent)}`,
          agentType: 'sales-assistant',
          tenantId: domainEvent.tenantId || 'default',
          userId: 'system',
          userRole: 'Admin',
        });
      } catch (err: any) {
        console.error(`[SQS] Error processing record: ${err.message}`);
        // Don't throw — let other records process
      }
    }

    return { statusCode: 200, body: `Processed ${event.Records.length} events` };
  }

  // HTTP events from API Gateway
  return server(event, context);
};
