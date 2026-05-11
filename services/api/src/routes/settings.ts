/**
 * Settings API — Save/Load AI config and LINE OA config
 * Stores in DynamoDB AI State table
 */
import { Hono } from 'hono';
import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';

const settings = new Hono();
const ddb = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const TABLE = process.env.AI_STATE_TABLE || 'sf7-prod-ai-state';

settings.put('/ai', async (c) => {
  const body = await c.req.json();
  const tenantId = c.req.header('x-tenant-id') || (c as any).get?.('tenantId') || 'default';
  await ddb.send(new PutItemCommand({
    TableName: TABLE,
    Item: {
      pk: { S: `TENANT#${tenantId}` },
      sk: { S: 'CONFIG#ai' },
      data: { S: JSON.stringify(body) },
      updatedAt: { S: new Date().toISOString() },
    },
  }));
  return c.json({ ok: true, message: 'AI config saved' });
});

settings.get('/ai', async (c) => {
  const tenantId = c.req.header('x-tenant-id') || (c as any).get?.('tenantId') || 'default';
  const res = await ddb.send(new GetItemCommand({
    TableName: TABLE,
    Key: { pk: { S: `TENANT#${tenantId}` }, sk: { S: 'CONFIG#ai' } },
  }));
  if (!res.Item) return c.json({});
  return c.json(JSON.parse(res.Item.data?.S || '{}'));
});

settings.put('/line', async (c) => {
  const body = await c.req.json();
  const tenantId = c.req.header('x-tenant-id') || (c as any).get?.('tenantId') || 'default';
  await ddb.send(new PutItemCommand({
    TableName: TABLE,
    Item: {
      pk: { S: `TENANT#${tenantId}` },
      sk: { S: 'CONFIG#line' },
      data: { S: JSON.stringify(body) },
      updatedAt: { S: new Date().toISOString() },
    },
  }));
  return c.json({ ok: true, message: 'LINE config saved' });
});

settings.get('/line', async (c) => {
  const tenantId = c.req.header('x-tenant-id') || (c as any).get?.('tenantId') || 'default';
  const res = await ddb.send(new GetItemCommand({
    TableName: TABLE,
    Key: { pk: { S: `TENANT#${tenantId}` }, sk: { S: 'CONFIG#line' } },
  }));
  if (!res.Item) return c.json({});
  return c.json(JSON.parse(res.Item.data?.S || '{}'));
});

export default settings;
