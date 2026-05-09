/**
 * AWS Lambda handler — Hono app for API Gateway v2 + SQS event processing.
 */
import { handle } from 'hono/aws-lambda';
import app from './app.js';
import { handleAgentEvent } from './routes/agents.js';

const honoHandler = handle(app);

export const handler = async (event: any, context: any) => {
  // SQS Events (domain events for agent processing)
  if (event?.Records && Array.isArray(event.Records) && event.Records[0]?.eventSource === 'aws:sqs') {
    for (const record of event.Records) {
      try {
        const domainEvent = JSON.parse(record.body);
        console.log(`[SQS] ${domainEvent.eventType} entity=${domainEvent.entityId}`);
        await handleAgentEvent(domainEvent);
      } catch (err: any) {
        console.error(`[SQS] Error: ${err.message}`);
      }
    }
    return { statusCode: 200, body: `Processed ${event.Records.length} events` };
  }

  // EventBridge Scheduled Events
  if (event?.source === 'aws.events' || event?.source === 'scheduled') {
    console.log(`[Scheduled] ${event.action || 'unknown'}`);
    return { statusCode: 200, body: 'Scheduled event processed' };
  }

  // HTTP Events (API Gateway)
  return honoHandler(event, context);
};
