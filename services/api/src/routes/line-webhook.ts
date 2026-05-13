import type { Context } from 'hono';
import * as crypto from 'crypto';

const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';
const TABLE = process.env.AI_STATE_TABLE || 'sf7-prod-ai-state';
const FUNCTION_NAME = process.env.AWS_LAMBDA_FUNCTION_NAME || 'sf7-prod-crm';

export async function handleLineWebhook(c: Context) {
  const body = await c.req.text();
  const signature = c.req.header('x-line-signature') || '';

  const { DynamoDBClient, GetItemCommand } = await import('@aws-sdk/client-dynamodb');
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });

  let channelSecret = process.env.LINE_CHANNEL_SECRET || '';
  let channelToken = process.env.LINE_CHANNEL_TOKEN || '';

  try {
    const cfg = await ddb.send(new GetItemCommand({ TableName: TABLE, Key: { PK: { S: `TENANT#${DEFAULT_TENANT}` }, SK: { S: 'CONFIG#line' } } }));
    if (cfg.Item?.data?.S) {
      const lc = JSON.parse(cfg.Item.data.S);
      channelSecret = lc.channelSecret || channelSecret;
      channelToken = lc.channelAccessToken || channelToken;
    }
  } catch {}

  if (!channelSecret || !channelToken) return c.json({ message: 'LINE not configured' }, 500);

  if (signature) {
    const hash = crypto.createHmac('SHA256', channelSecret).update(body).digest('base64');
    if (hash !== signature) return c.json({ message: 'Invalid signature' }, 403);
  }

  const data = JSON.parse(body);
  const events = data.events || [];

  const { LambdaClient, InvokeCommand } = await import('@aws-sdk/client-lambda');
  const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });

  for (const event of events) {
    if (event.type !== 'message' || event.message?.type !== 'text') continue;
    await lambda.send(new InvokeCommand({
      FunctionName: FUNCTION_NAME,
      InvocationType: 'Event',
      Payload: new TextEncoder().encode(JSON.stringify({
        _lineProcess: true,
        message: event.message.text,
        lineUserId: event.source?.userId || '',
        channelToken,
      })),
    }));
  }

  return c.json({ ok: true });
}

export async function processLineAsync(event: any) {
  const { message, lineUserId, channelToken } = event;
  let agentReply = 'ขออภัยค่ะ ระบบขัดข้อง กรุณาลองใหม่ค่ะ';

  try {
    const { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } = await import('@aws-sdk/client-bedrock-agentcore');
    const client = new BedrockAgentCoreClient({ region: 'ap-southeast-1' });
    const sid = `line-${lineUserId}-v3`;
    const resp = await client.send(new InvokeAgentRuntimeCommand({
      agentRuntimeArn: process.env.ADMIN_AI_RUNTIME_ARN || process.env.AGENTCORE_RUNTIME_ARN || '',
      runtimeSessionId: sid,
      payload: new TextEncoder().encode(JSON.stringify({ message, agentType: 'admin-ai', tenantId: DEFAULT_TENANT })),
      qualifier: 'DEFAULT',
    }));
    let responseBody = '';
    const r = resp.response;
    if (r && typeof (r as any).transformToString === 'function') responseBody = await (r as any).transformToString();
    else if (r && typeof (r as any).read === 'function') { const chunks: Buffer[] = []; for await (const chunk of r as any) { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); } responseBody = Buffer.concat(chunks).toString('utf-8'); }
    if (responseBody) { const p = JSON.parse(responseBody); agentReply = p.reply || p.message || responseBody.slice(0, 500); }
  } catch (e: any) { console.error('[LINE] Agent:', e.message); }

  // Use line-reply Lambda (outside VPC) to push message
  const { LambdaClient, InvokeCommand } = await import('@aws-sdk/client-lambda');
  const lambda = new LambdaClient({ region: 'ap-southeast-1' });
  const pushResult = await lambda.send(new InvokeCommand({
    FunctionName: 'sf7-prod-line-reply',
    Payload: new TextEncoder().encode(JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text: agentReply.slice(0, 5000) }],
      channelToken,
    })),
  }));
  const pushResp = JSON.parse(new TextDecoder().decode(pushResult.Payload));
  console.log('[LINE] Push result:', pushResp.statusCode);
}
