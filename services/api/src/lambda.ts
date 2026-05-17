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

  // Agent async task (invoked by self with InvocationType: Event)
  if (event?._agentTask) {
    const { DynamoDBClient, PutItemCommand } = await import('@aws-sdk/client-dynamodb');
    const { runAgentTask } = await import('./routes/agents.js');
    const ddb = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
    const table = process.env.AI_STATE_TABLE || 'sf7-prod-ai-state';
    try {
      const reply = await runAgentTask(event.message, event.agentType, event.tenantId, event.sessionId);
      const result = { reply, agentUsed: event.agentType === 'analytics' ? 'น้องวิ' : 'น้องขายไว' };
      await ddb.send(new PutItemCommand({ TableName: table, Item: { PK: { S: `TASK#${event.taskId}` }, SK: { S: 'STATUS' }, status: { S: 'done' }, reply: { S: result.reply }, agentUsed: { S: result.agentUsed }, completedAt: { S: new Date().toISOString() } } }));
    } catch (err: any) {
      console.error('[StrandsAgent] Error:', err.message);
      await ddb.send(new PutItemCommand({ TableName: table, Item: { PK: { S: `TASK#${event.taskId}` }, SK: { S: 'STATUS' }, status: { S: 'error' }, reply: { S: 'ขออภัยค่ะ: ' + String(err.message || '').slice(0, 200) }, completedAt: { S: new Date().toISOString() } } }));
    }
    return { statusCode: 200, body: 'Agent task done' };
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
