import type { Context } from 'hono';
import * as crypto from 'crypto';
import { queryNoRLS } from '../lib/db.js';

const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';
const TABLE = process.env.AI_STATE_TABLE || 'sf7-prod-ai-state';

export async function handleLineWebhook(c: Context) {
  const body = await c.req.text();
  const signature = c.req.header('x-line-signature') || '';

  // Get LINE config from DynamoDB
  const { DynamoDBClient, GetItemCommand } = await import('@aws-sdk/client-dynamodb');
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });

  let channelSecret = process.env.LINE_CHANNEL_SECRET || '';
  let channelToken = process.env.LINE_CHANNEL_TOKEN || '';

  try {
    const cfg = await ddb.send(new GetItemCommand({
      TableName: TABLE,
      Key: { PK: { S: `TENANT#${DEFAULT_TENANT}` }, SK: { S: 'CONFIG#line' } },
    }));
    if (cfg.Item?.data?.S) {
      const lineConfig = JSON.parse(cfg.Item.data.S);
      channelSecret = lineConfig.channelSecret || channelSecret;
      channelToken = lineConfig.channelAccessToken || channelToken;
    }
  } catch { /* use env fallback */ }

  if (!channelSecret || !channelToken) {
    return c.json({ message: 'LINE not configured' }, 500);
  }

  // Verify signature (skip if no signature — for testing)
  if (signature) {
    const hash = crypto.createHmac('SHA256', channelSecret).update(body).digest('base64');
    if (hash !== signature) {
      return c.json({ message: 'Invalid signature' }, 403);
    }
  }

  const data = JSON.parse(body);
  const events = data.events || [];

  for (const event of events) {
    if (event.type !== 'message' || event.message?.type !== 'text') continue;

    const userMessage = event.message.text;
    const replyToken = event.replyToken;
    const lineUserId = event.source?.userId || '';

    // Call น้องแอ๊ด via AgentCore
    let agentReply = 'ขออภัยค่ะ ระบบขัดข้อง กรุณาลองใหม่อีกครั้งค่ะ';
    try {
      const { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } = await import('@aws-sdk/client-bedrock-agentcore');
      const agentClient = new BedrockAgentCoreClient({ region: 'ap-southeast-1' });
      const RUNTIME_ARN = process.env.AGENTCORE_RUNTIME_ARN || '';
      const sessionId = `line-${lineUserId}-${Date.now()}`;

      const payload = JSON.stringify({
        message: userMessage,
        agentType: 'admin-ai',
        tenantId: DEFAULT_TENANT,
        sessionId,
      });

      const agentResp = await agentClient.send(new InvokeAgentRuntimeCommand({
        agentRuntimeArn: RUNTIME_ARN,
        runtimeSessionId: sessionId,
        payload: new TextEncoder().encode(payload),
        qualifier: 'DEFAULT',
      }));

      let responseBody = '';
      const r = agentResp.response;
      if (r && typeof (r as any).transformToString === 'function') {
        responseBody = await (r as any).transformToString();
      } else if (r && typeof (r as any).read === 'function') {
        const chunks: Buffer[] = [];
        for await (const chunk of r as any) { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); }
        responseBody = Buffer.concat(chunks).toString('utf-8');
      }
      if (responseBody) {
        const parsed = JSON.parse(responseBody);
        agentReply = parsed.reply || parsed.message || responseBody.slice(0, 500);
      }
    } catch (err: any) {
      console.error('[LINE] Agent error:', err.message);
    }

    // Reply via LINE Messaging API
    try {
      await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${channelToken}` },
        body: JSON.stringify({ replyToken, messages: [{ type: 'text', text: agentReply.slice(0, 5000) }] }),
      });
    } catch (err: any) {
      console.error('[LINE] Reply error:', err.message);
    }
  }

  return c.json({ ok: true });
}
