import { handle } from 'hono/aws-lambda';
import app from './app.js';
import { handleAgentEvent } from './routes/agents.js';
import { processLineAsync } from './routes/line-webhook.js';

const honoHandler = handle(app);

export const handler = async (event: any, context: any) => {
  // LINE async processing (invoked by self with InvocationType: Event)
  if (event?._lineProcess) {
    await processLineAsync(event);
    return { statusCode: 200, body: 'LINE processed' };
  }

  // SQS Events
  if (event?.Records && Array.isArray(event.Records) && event.Records[0]?.eventSource === 'aws:sqs') {
    for (const record of event.Records) {
      try {
        const domainEvent = JSON.parse(record.body);
        await handleAgentEvent(domainEvent);
      } catch (err: any) {
        console.error('[SQS] Error:', err.message);
      }
    }
    return { statusCode: 200, body: 'OK' };
  }

  // Scheduled Events
  if (event?.source === 'aws.events' || event?.source === 'scheduled') {
    return { statusCode: 200, body: 'OK' };
  }

  // HTTP Events (API Gateway)
  return honoHandler(event, context);
};
