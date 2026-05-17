/**
 * SalesFAST 7 — WebSocket Lambda Handler
 * Uses AgentCore Runtime with real-time progress updates
 */
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBClient, PutItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';

const TABLE = process.env.WS_CONNECTIONS_TABLE || 'sf7-prod-ws-connections';
const AGENTCORE_ARN = process.env.AGENTCORE_RUNTIME_ARN || '';
const AGENTCORE_REGION = process.env.AGENTCORE_REGION || 'ap-southeast-1';
const ddb = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });

async function send(endpoint: string, connId: string, data: any) {
  const client = new ApiGatewayManagementApiClient({ endpoint });
  try {
    await client.send(new PostToConnectionCommand({ ConnectionId: connId, Data: new TextEncoder().encode(JSON.stringify(data)) }));
  } catch (err: any) {
    if (err.statusCode === 410) await ddb.send(new DeleteItemCommand({ TableName: TABLE, Key: { connectionId: { S: connId } } }));
  }
}

function detectAgent(msg: string): string {
  const l = msg.toLowerCase();
  if (['forecast','พยากรณ์','churn','win rate','conversion','เปรียบเทียบ','performance','ผลงาน','revenue','kpi','วิเคราะห์','pipeline'].some(k => l.includes(k))) return 'analytics';
  if (['สนใจสินค้า','ขอใบเสนอราคา','สอบถามราคา','บริการอะไร','ราคาเท่าไหร่'].some(k => l.includes(k))) return 'admin';
  return 'sales-assistant';
}

function agentName(t: string): string {
  if (t === 'analytics') return 'น้องวิ';
  if (t === 'admin-ai' || t === 'admin') return 'น้องแอ๊ด';
  return 'น้องขายไว';
}

async function callAgentCore(message: string, agentType: string, tenantId: string, sessionId: string): Promise<string> {
  const { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } = await import('@aws-sdk/client-bedrock-agentcore');
  const client = new BedrockAgentCoreClient({ region: AGENTCORE_REGION });
  const resp: any = await client.send(new InvokeAgentRuntimeCommand({
    agentRuntimeArn: AGENTCORE_ARN, runtimeSessionId: sessionId,
    payload: new TextEncoder().encode(JSON.stringify({ message, agentType, tenantId, sessionId })), qualifier: 'DEFAULT',
  }));
  const r = resp.response;
  if (!r) return '';
  if (typeof r === 'string') return r;
  if (typeof r.transformToString === 'function') return await r.transformToString();
  if (r instanceof Uint8Array || Buffer.isBuffer(r)) return new TextDecoder().decode(r);
  if (typeof r[Symbol.asyncIterator] === 'function') {
    const chunks: Uint8Array[] = [];
    for await (const chunk of r) chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
    return new TextDecoder().decode(Buffer.concat(chunks));
  }
  return JSON.stringify(r);
}

export const handler = async (event: any) => {
  const { routeKey, connectionId, domainName, stage } = event.requestContext;
  const endpoint = `https://${domainName}/${stage}`;

  if (routeKey === '$connect') {
    await ddb.send(new PutItemCommand({ TableName: TABLE, Item: { connectionId: { S: connectionId }, ttl: { N: String(Math.floor(Date.now()/1000)+7200) } } }));
    return { statusCode: 200, body: 'Connected' };
  }
  if (routeKey === '$disconnect') {
    await ddb.send(new DeleteItemCommand({ TableName: TABLE, Key: { connectionId: { S: connectionId } } }));
    return { statusCode: 200, body: 'Disconnected' };
  }
  if (routeKey === 'sendMessage') {
    let data: any;
    try { data = JSON.parse(event.body || '{}'); } catch { data = {}; }
    const message = data.message || '';
    const tenantId = (!data.tenantId || data.tenantId === 'default') ? '00000000-0000-0000-0000-000000000001' : data.tenantId;
    const agentType = (data.agentType && data.agentType !== 'sales-assistant') ? data.agentType : detectAgent(message);
    const sessionId = data.sessionId || `sf7-ws-${connectionId}-${Date.now()}`.padEnd(33, '0');

    if (!message) { await send(endpoint, connectionId, { type: 'error', message: 'กรุณาพิมพ์ข้อความค่ะ' }); return { statusCode: 200, body: 'OK' }; }

    // Send typing
    await send(endpoint, connectionId, { type: 'typing', agentUsed: agentName(agentType) });

    try {
      const raw = await callAgentCore(message, agentType, tenantId, sessionId);
      let reply = '', used = agentName(agentType);
      try { const p = JSON.parse(raw); const o = p.output || p; reply = o.reply || o.message || o.text || raw; used = o.agentUsed || used; } catch { reply = raw || 'ไม่มีข้อความ'; }
      await send(endpoint, connectionId, { type: 'message', reply, agentUsed: used, sessionId, backend: 'agentcore' });
    } catch (err: any) {
      await send(endpoint, connectionId, { type: 'error', message: 'ขออภัยค่ะ: ' + String(err.message||'').slice(0,100), agentUsed: agentName(agentType) });
    }
    return { statusCode: 200, body: 'OK' };
  }
  return { statusCode: 200, body: 'OK' };
};
