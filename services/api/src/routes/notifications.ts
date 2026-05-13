import { Hono } from 'hono';
import { query, queryNoRLS } from '../lib/db.js';
import { authMiddleware } from '../lib/auth.js';
import * as crypto from 'crypto';

const notifications = new Hono();

// ══════════════════════════════════════════════════════════════
// LINE Webhook — No auth (verified by signature)
// ══════════════════════════════════════════════════════════════

notifications.post('/line/webhook', async (c) => {
  const body = await c.req.text();
  const signature = c.req.header('x-line-signature') || '';

  // Get LINE config from DynamoDB
  const { DynamoDBClient, GetItemCommand } = await import('@aws-sdk/client-dynamodb');
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
  const TABLE = process.env.AI_STATE_TABLE || 'sf7-prod-ai-state';
  const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';

  let channelSecret = '';
  let channelToken = '';
  try {
    const cfg = await ddb.send(new GetItemCommand({
      TableName: TABLE,
      Key: { PK: { S: `TENANT#${DEFAULT_TENANT}` }, SK: { S: 'CONFIG#line' } },
    }));
    if (cfg.Item?.data?.S) {
      const lineConfig = JSON.parse(cfg.Item.data.S);
      channelSecret = lineConfig.channelSecret || '';
      channelToken = lineConfig.channelAccessToken || '';
    }
  } catch { /* use env fallback */ }

  // Fallback to env vars
  if (!channelSecret) channelSecret = process.env.LINE_CHANNEL_SECRET || '';
  if (!channelToken) channelToken = process.env.LINE_CHANNEL_TOKEN || '';

  if (!channelSecret || !channelToken) {
    return c.json({ message: 'LINE not configured' }, 500);
  }

  // Verify signature
  const hash = crypto.createHmac('SHA256', channelSecret).update(body).digest('base64');
  if (hash !== signature) {
    return c.json({ message: 'Invalid signature' }, 403);
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
        lineUserId,
      });

      const agentResp = await agentClient.send(new InvokeAgentRuntimeCommand({
        agentRuntimeArn: RUNTIME_ARN,
        runtimeSessionId: sessionId,
        payload: new TextEncoder().encode(payload),
        qualifier: 'DEFAULT',
      }));

      // Parse response
      let responseBody = '';
      const r = agentResp.response;
      if (r && typeof r.transformToString === 'function') {
        responseBody = await r.transformToString();
      } else if (r && typeof r.read === 'function') {
        const chunks: Buffer[] = [];
        for await (const chunk of r) { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); }
        responseBody = Buffer.concat(chunks).toString('utf-8');
      }
      if (responseBody) {
        const parsed = JSON.parse(responseBody);
        agentReply = parsed.reply || parsed.message || responseBody.slice(0, 500);
      }
    } catch (err: any) {
      console.error('[LINE Webhook] Agent error:', err.message);
    }

    // Reply via LINE Messaging API
    try {
      const replyBody = JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text: agentReply.slice(0, 5000) }],
      });
      await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${channelToken}`,
        },
        body: replyBody,
      });
    } catch (err: any) {
      console.error('[LINE Webhook] Reply error:', err.message);
    }

    // Log to DB
    try {
      await queryNoRLS(
        `INSERT INTO notifications (tenant_id, user_id, channel, type, title, body, metadata, status)
         VALUES ($1, $2, 'line', 'line_message', $3, $4, $5, 'delivered')`,
        [DEFAULT_TENANT, '00000000-0000-0000-0000-000000000100', 'LINE: ' + (lineUserId || '').slice(-6), userMessage.slice(0, 100), JSON.stringify({ lineUserId, replyToken, agentReply: agentReply.slice(0, 200) })]
      );
    } catch { /* non-critical */ }
  }

  return c.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════
// Authenticated routes
// ══════════════════════════════════════════════════════════════

notifications.use('/*', authMiddleware);

notifications.get('/', async (c) => {
  const t = c.get('tenantId');
  const userId = c.get('userId');
  const limit = parseInt(c.req.query('limit') || '20');
  const r = await query(t,
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]);
  return c.json(r.rows);
});

notifications.post('/', async (c) => {
  const t = c.get('tenantId');
  const b = await c.req.json().catch(() => ({}));
  const r = await query(t,
    `INSERT INTO notifications (tenant_id, user_id, channel, type, title, body, metadata, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`,
    [t, b.userId, b.channel||'in_app', b.type||'general', b.title||'', b.body||'', JSON.stringify(b.metadata||{})]);
  return c.json(r.rows[0], 201);
});

export default notifications;
