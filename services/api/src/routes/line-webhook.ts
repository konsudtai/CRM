/**
 * LINE OA — Step-by-Step Lead Collection Chatbot
 * 
 * Flow: สนใจสินค้า → ชื่อ → บริษัท → เบอร์ → งบ → สร้าง Lead → แจ้ง Sales Manager
 * No AI — pure state machine, 100% stable
 */
import type { Context } from 'hono';
import * as crypto from 'crypto';
import { query } from '../lib/db.js';

const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';
const TABLE = process.env.AI_STATE_TABLE || 'sf7-prod-ai-state';
const SQS_URL = process.env.SQS_QUEUE_URL || '';
const FUNCTION_NAME = process.env.AWS_LAMBDA_FUNCTION_NAME || 'sf7-prod-crm';

// ══════════════════════════════════════════════════════════════
// LINE Webhook Entry
// ══════════════════════════════════════════════════════════════

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

  // Process async (avoid LINE 1s timeout)
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

// ══════════════════════════════════════════════════════════════
// Async Processing — State Machine
// ══════════════════════════════════════════════════════════════

const PRODUCTS = [
  { label: 'Cloud Migration', value: 'Cloud Migration' },
  { label: 'Managed Cloud', value: 'Managed Cloud' },
  { label: 'Microsoft 365', value: 'Microsoft 365' },
  { label: 'Web/Mobile App', value: 'Web/Mobile App' },
  { label: 'IT Support', value: 'IT Support' },
  { label: 'Security Audit', value: 'Security Audit' },
  { label: 'Network/Firewall', value: 'Network/Firewall' },
];

const BUDGETS = [
  { label: 'ต่ำกว่า 50K', value: '< 50,000' },
  { label: '50K - 200K', value: '50,000 - 200,000' },
  { label: '200K - 500K', value: '200,000 - 500,000' },
  { label: '500K - 1M', value: '500,000 - 1,000,000' },
  { label: 'มากกว่า 1M', value: '> 1,000,000' },
];

interface ChatState {
  step: 'product' | 'name' | 'company' | 'phone' | 'budget' | 'done';
  data: { product?: string; name?: string; company?: string; phone?: string; budget?: string };
}

export async function processLineAsync(event: any) {
  const { message, lineUserId, channelToken } = event;
  const { DynamoDBClient, GetItemCommand, PutItemCommand, DeleteItemCommand } = await import('@aws-sdk/client-dynamodb');
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });

  // Load state
  let state: ChatState = { step: 'product', data: {} };
  try {
    const res = await ddb.send(new GetItemCommand({ TableName: TABLE, Key: { PK: { S: `LINE#${lineUserId}` }, SK: { S: 'CHAT_STATE' } } }));
    if (res.Item?.data?.S) state = JSON.parse(res.Item.data.S);
  } catch {}

  let reply = '';

  const msgLower = message.trim().toLowerCase();

  // ── ดูสินค้า — Product Catalog from DB ──
  if (message === 'ดูสินค้า' || message === 'สินค้า' || message === 'catalog' || msgLower === 'product') {
    await handleProductCatalog(lineUserId, message, channelToken, ddb);
    return;
  }

  // ── เลือกหมวดสินค้า (prefix match from catalog browsing) ──
  if (message.startsWith('CAT:')) {
    await handleProductCategory(lineUserId, message.replace('CAT:', ''), channelToken);
    return;
  }

  // Status check — ลูกค้าเช็คสถานะ Lead ของตัวเอง
  if (message === 'เช็คสถานะ' || message === 'ติดตามงาน' || message === 'สถานะ' || msgLower === 'status') {
    try {
      const leadResults = await query(DEFAULT_TENANT,
        `SELECT l.name, l.status, l.company_name,
         u.first_name || ' ' || u.last_name as rep_name, u.phone as rep_phone,
         (SELECT q.quotation_number || ' (' || q.status || ')' FROM quotations q WHERE q.account_id IN (SELECT id FROM accounts WHERE company_name = l.company_name) ORDER BY q.created_at DESC LIMIT 1) as latest_qt
         FROM leads l
         LEFT JOIN users u ON u.id = l.assigned_to
         WHERE l.metadata->>'lineUserId' = $1
         ORDER BY l.created_at DESC LIMIT 1`,
        [lineUserId]);

      if (leadResults.rows.length > 0) {
        const leadData = leadResults.rows[0];
        const statusTh: Record<string,string> = { 'New': 'รอติดต่อกลับ', 'Contacted': 'กำลังติดต่อ', 'Qualified': 'ผ่านคุณสมบัติแล้ว', 'Proposal': 'กำลังจัดทำใบเสนอราคา', 'Negotiation': 'อยู่ระหว่างเจรจา', 'Won': 'ปิดการขายแล้ว', 'Lost': 'ยกเลิก' };
        let msg = `สวัสดีค่ะคุณ${leadData.name} นี่คือสถานะล่าสุดค่ะ

`;
        msg += `สถานะ: ${statusTh[leadData.status] || leadData.status}
`;
        if (leadData.rep_name) msg += `ผู้ดูแล: คุณ${leadData.rep_name}${leadData.rep_phone ? ' (' + leadData.rep_phone + ')' : ''}
`;
        else msg += `ผู้ดูแล: ยังไม่ได้มอบหมาย (ทีมงานกำลังจัดสรรให้ค่ะ)
`;
        if (leadData.latest_qt) msg += `ใบเสนอราคา: ${leadData.latest_qt}
`;
        else msg += `ใบเสนอราคา: ยังไม่มี
`;
        msg += `
หากมีข้อสงสัยเพิ่มเติม พิมพ์ "สนใจสินค้า" เพื่อแจ้งความต้องการใหม่ค่ะ`;
        reply = msg;
      } else {
        reply = 'ไม่พบข้อมูลในระบบค่ะ หากต้องการลงทะเบียน พิมพ์ "สนใจสินค้า" ได้เลยค่ะ';
      }
    } catch (e: any) {
      reply = 'ขออภัยค่ะ ไม่สามารถเช็คสถานะได้ในขณะนี้ กรุณาลองใหม่ค่ะ';
      console.error('[LINE] Status check error:', e.message);
    }
    await replyLine(lineUserId, reply, channelToken);
    return;
  }

  // Reset command
  if (message === 'เริ่มใหม่' || message === 'reset' || message === '/start' || message === 'สวัสดี' || message === 'หวัดดี' || msgLower === 'hi' || msgLower === 'hello') {
    state = { step: 'product', data: {} };
    const resetReply = 'สวัสดีค่ะ ยินดีให้บริการค่ะ เลือกจากเมนูด้านล่างได้เลยนะคะ';
    const resetQR = { items: [
      { type: 'action', action: { type: 'message', label: 'สนใจสินค้า/บริการ', text: 'สนใจสินค้า' } },
      { type: 'action', action: { type: 'message', label: 'ดูสินค้า', text: 'ดูสินค้า' } },
      { type: 'action', action: { type: 'message', label: 'เช็คสถานะ', text: 'เช็คสถานะ' } },
    ] };

    // Save state & reply immediately
    await ddb.send(new PutItemCommand({
      TableName: TABLE,
      Item: {
        PK: { S: `LINE#${lineUserId}` }, SK: { S: 'CHAT_STATE' },
        data: { S: JSON.stringify(state) },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 3600) },
      },
    }));
    await replyLine(lineUserId, resetReply, channelToken, resetQR);
    return;
  }

  // Process based on current step
  reply = '';
  let quickReply: any = null;

  switch (state.step) {
    case 'product':
      // Check if message matches a known product OR accept free-text
      const matchedProduct = PRODUCTS.find(p => message.includes(p.value) || message.includes(p.label));
      // Also check if it starts with "สนใจ " (from Flex Message button)
      const flexMatch = message.startsWith('สนใจ ') ? message.replace('สนใจ ', '') : null;
      if (matchedProduct) {
        state.data.product = matchedProduct.value;
        state.step = 'name';
        reply = `สนใจ ${matchedProduct.value} นะคะ\n\nขอทราบชื่อ-นามสกุลค่ะ (พิมพ์ได้เลย)`;
      } else if (flexMatch && flexMatch.length >= 2) {
        state.data.product = flexMatch;
        state.step = 'name';
        reply = `สนใจ ${flexMatch} นะคะ\n\nขอทราบชื่อ-นามสกุลค่ะ (พิมพ์ได้เลย)`;
      } else if (message === 'สนใจสินค้า' || message === 'สนใจบริการ' || message === 'ลูกค้าใหม่') {
        // Show product options but also accept free text
        reply = 'สนใจสินค้า/บริการอะไรดีคะ เลือกจากด้านล่าง หรือพิมพ์ได้เลยค่ะ';
        quickReply = { items: PRODUCTS.map(p => ({ type: 'action', action: { type: 'message', label: p.label, text: p.value } })) };
      } else if (message.length >= 2 && message.length <= 200) {
        // Accept any free-text as product interest
        state.data.product = message;
        state.step = 'name';
        reply = `สนใจ "${message}" นะคะ\n\nขอทราบชื่อ-นามสกุลค่ะ (พิมพ์ได้เลย)`;
      } else {
        reply = 'สนใจสินค้า/บริการอะไรดีคะ เลือกจากด้านล่าง หรือพิมพ์ได้เลยค่ะ';
        quickReply = { items: PRODUCTS.map(p => ({ type: 'action', action: { type: 'message', label: p.label, text: p.value } })) };
      }
      break;

    case 'name':
      if (message.length >= 2 && message.length <= 100) {
        state.data.name = message;
        state.step = 'company';
        reply = `คุณ${message} นะคะ ✅\n\nขอทราบชื่อบริษัท/องค์กรค่ะ\n(พิมพ์ "-" ถ้าเป็นส่วนตัว)`;
      } else {
        reply = 'ขอทราบชื่อ-นามสกุลค่ะ (เช่น สมชาย ใจดี)';
      }
      break;

    case 'company':
      state.data.company = (message === '-' || message === 'ไม่มี') ? '' : message;
      state.step = 'phone';
      reply = '✅ ขอเบอร์โทรติดต่อกลับค่ะ';
      break;

    case 'phone':
      const phone = message.replace(/[- ]/g, '');
      if (/^0\d{8,9}$/.test(phone)) {
        state.data.phone = message;
        state.step = 'budget';
        reply = '✅ ขอทราบงบประมาณโดยประมาณค่ะ';
        quickReply = { items: BUDGETS.map(b => ({ type: 'action', action: { type: 'message', label: b.label, text: b.value } })) };
      } else {
        reply = 'กรุณากรอกเบอร์โทรให้ถูกต้องค่ะ (เช่น 081-234-5678)';
      }
      break;

    case 'budget':
      const matchedBudget = BUDGETS.find(b => message.includes(b.value) || message.includes(b.label));
      state.data.budget = matchedBudget ? matchedBudget.value : message;
      state.step = 'done';

      // Create Lead in RDS
      const leadResult = await createLead(state.data, lineUserId);

      // Create notifications directly for Sales Manager + Admin
      await notifyManagers(leadResult.leadId, state.data);

      reply = `✅ ส่งข้อมูลเรียบร้อยแล้วค่ะ!\n\n📋 สรุป:\n- ชื่อ: ${state.data.name}\n- บริษัท: ${state.data.company || '-'}\n- เบอร์: ${state.data.phone}\n- สนใจ: ${state.data.product}\n- งบ: ${state.data.budget}\n\nทีมงานจะติดต่อกลับภายใน 24 ชม. ค่ะ 🙏\n\n(พิมพ์ "สนใจสินค้า" เพื่อเริ่มใหม่)`;

      // Reset state after done
      await ddb.send(new DeleteItemCommand({ TableName: TABLE, Key: { PK: { S: `LINE#${lineUserId}` }, SK: { S: 'CHAT_STATE' } } }));
      break;

    default:
      state = { step: 'product', data: {} };
      reply = 'สวัสดีค่ะ ยินดีให้บริการค่ะ เลือกจากเมนูด้านล่างได้เลยนะคะ';
      quickReply = { items: [
        { type: 'action', action: { type: 'message', label: 'สนใจสินค้า/บริการ', text: 'สนใจสินค้า' } },
        { type: 'action', action: { type: 'message', label: 'ดูสินค้า', text: 'ดูสินค้า' } },
        { type: 'action', action: { type: 'message', label: 'เช็คสถานะ', text: 'เช็คสถานะ' } },
      ] };
  }

  // Save state (unless done)
  if (state.step !== 'done') {
    await ddb.send(new PutItemCommand({
      TableName: TABLE,
      Item: {
        PK: { S: `LINE#${lineUserId}` }, SK: { S: 'CHAT_STATE' },
        data: { S: JSON.stringify(state) },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 3600) }, // 1hr TTL
      },
    }));
  }

  // Reply to LINE
  await replyLine(lineUserId, reply, channelToken, quickReply);
}

// ══════════════════════════════════════════════════════════════
// Product Catalog — ดูสินค้าจาก DB
// ══════════════════════════════════════════════════════════════

const SKU_CATEGORIES: Record<string, string> = {
  'NB': 'Notebook',
  'DT': 'Desktop',
  'MN': 'Monitor',
  'SV': 'Server',
  'NAS': 'NAS Storage',
  'UPS': 'UPS',
  'SW': 'Network Switch',
  'AP': 'Access Point',
  'FW': 'Firewall',
  'PR': 'Printer',
  'SSD': 'SSD',
  'HDD': 'HDD',
  'RAM': 'RAM',
  'LIC': 'Software License',
  'CBL': 'Cable/Infra',
  'PP': 'Cable/Infra',
  'RACK': 'Cable/Infra',
  'KVM': 'Accessories',
  'WC': 'Accessories',
  'VC': 'Conference/AV',
  'PJ': 'Conference/AV',
  'ID': 'Conference/AV',
  'SVC': 'Service',
};

function getCategory(sku: string): string {
  const prefix = sku.split('-')[0];
  return SKU_CATEGORIES[prefix] || 'Other';
}

async function handleProductCatalog(lineUserId: string, _message: string, channelToken: string, _ddb: any) {
  try {
    // Get distinct categories from active products
    const result = await query(DEFAULT_TENANT,
      `SELECT DISTINCT substring(sku from '^[A-Z]+') as prefix, COUNT(*) as cnt
       FROM products WHERE tenant_id = $1 AND is_active = true
       GROUP BY prefix ORDER BY prefix`,
      [DEFAULT_TENANT]);

    // Group by display category
    const catMap: Record<string, number> = {};
    for (const row of result.rows) {
      const cat = SKU_CATEGORIES[row.prefix] || row.prefix;
      catMap[cat] = (catMap[cat] || 0) + Number(row.cnt);
    }

    const categories = Object.entries(catMap).sort((a, b) => a[0].localeCompare(b[0]));

    if (categories.length === 0) {
      await replyLine(lineUserId, 'ยังไม่มีสินค้าในระบบค่ะ', channelToken);
      return;
    }

    // Send Quick Reply with categories (max 13 items per LINE limit)
    const items = categories.slice(0, 13).map(([cat, cnt]) => ({
      type: 'action',
      action: { type: 'message', label: `${cat} (${cnt})`, text: `CAT:${cat}` },
    }));

    await replyLine(lineUserId, `มีสินค้าทั้งหมด ${Object.values(catMap).reduce((a, b) => a + b, 0)} รายการค่ะ เลือกหมวดที่สนใจได้เลยค่ะ`, channelToken, { items });
  } catch (e: any) {
    console.error('[LINE] Product catalog error:', e.message);
    await replyLine(lineUserId, 'ไม่สามารถดึงข้อมูลสินค้าได้ในขณะนี้ค่ะ', channelToken);
  }
}

async function handleProductCategory(lineUserId: string, category: string, channelToken: string) {
  try {
    // Find SKU prefixes for this category
    const prefixes = Object.entries(SKU_CATEGORIES)
      .filter(([_, cat]) => cat === category)
      .map(([prefix]) => prefix);

    let whereClause: string;
    let params: any[];

    if (prefixes.length > 0) {
      const likeClauses = prefixes.map((_, i) => `sku LIKE $${i + 2} || '-%'`).join(' OR ');
      whereClause = `tenant_id = $1 AND is_active = true AND (${likeClauses})`;
      params = [DEFAULT_TENANT, ...prefixes];
    } else {
      whereClause = `tenant_id = $1 AND is_active = true`;
      params = [DEFAULT_TENANT];
    }

    const result = await query(DEFAULT_TENANT,
      `SELECT name, sku, description, unit_price, unit_of_measure
       FROM products WHERE ${whereClause}
       ORDER BY unit_price ASC LIMIT 10`,
      params);

    if (result.rows.length === 0) {
      await replyLine(lineUserId, `ไม่พบสินค้าในหมวด "${category}" ค่ะ`, channelToken);
      return;
    }

    // Build Flex Message carousel
    const bubbles = result.rows.map((p: any) => ({
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: p.name, weight: 'bold', size: 'sm', wrap: true, maxLines: 2 },
          { type: 'text', text: p.description || '-', size: 'xs', color: '#666666', wrap: true, maxLines: 2, margin: 'sm' },
          { type: 'text', text: `SKU: ${p.sku}`, size: 'xxs', color: '#999999', margin: 'sm' },
          {
            type: 'box', layout: 'horizontal', margin: 'md', contents: [
              { type: 'text', text: `${Number(p.unit_price).toLocaleString()} บาท`, size: 'sm', weight: 'bold', color: '#1a56db' },
              { type: 'text', text: `/${p.unit_of_measure || 'ชิ้น'}`, size: 'xxs', color: '#999999', align: 'end', gravity: 'bottom' },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: { type: 'message', label: 'สนใจสินค้านี้', text: `สนใจ ${p.name}` },
            style: 'primary',
            height: 'sm',
            color: '#1a56db',
          },
        ],
      },
    }));

    const flexMessage = {
      type: 'flex',
      altText: `สินค้าหมวด ${category} (${result.rows.length} รายการ)`,
      contents: { type: 'carousel', contents: bubbles },
    };

    await replyLineFlex(lineUserId, [flexMessage], channelToken);
  } catch (e: any) {
    console.error('[LINE] Product category error:', e.message);
    await replyLine(lineUserId, 'ไม่สามารถดึงข้อมูลได้ค่ะ กรุณาลองใหม่', channelToken);
  }
}

// ══════════════════════════════════════════════════════════════
// Create Lead in RDS
// ══════════════════════════════════════════════════════════════

async function createLead(data: any, lineUserId: string): Promise<{ leadId: string }> {
  const notes = `สนใจ: ${data.product} | งบ: ${data.budget || 'ไม่ระบุ'} | LINE: ${lineUserId}`;
  const meta = JSON.stringify({ estimatedValue: parseBudget(data.budget), notes, lineUserId });

  // Generate lead_code
  await query(DEFAULT_TENANT, `INSERT INTO lead_sequences (tenant_id, current_value) VALUES ($1, 0) ON CONFLICT (tenant_id) DO NOTHING`, [DEFAULT_TENANT]);
  const seqRes = await query(DEFAULT_TENANT, `UPDATE lead_sequences SET current_value = current_value + 1 WHERE tenant_id = $1 RETURNING current_value`, [DEFAULT_TENANT]);
  const leadCode = 'L-' + String(seqRes.rows[0].current_value).padStart(4, '0');

  const result = await query(DEFAULT_TENANT,
    `INSERT INTO leads (tenant_id, name, company_name, phone, source, status, metadata, lead_code)
     VALUES ($1, $2, $3, $4, 'line', 'New', $5, $6) RETURNING id`,
    [DEFAULT_TENANT, data.name, data.company || null, data.phone, meta, leadCode]
  );

  const leadId = result.rows[0]?.id || '';

  // Record initial status in history
  if (leadId) {
    try {
      await query(DEFAULT_TENANT,
        `INSERT INTO lead_histories (lead_id, field_name, old_value, new_value, notes) VALUES ($1, 'status', NULL, 'New', 'สร้างจาก LINE OA')`,
        [leadId]);
    } catch {}
  }

  return { leadId };
}

function parseBudget(budget: string): number {
  if (!budget) return 0;
  if (budget.includes('50,000 - 200,000')) return 125000;
  if (budget.includes('200,000 - 500,000')) return 350000;
  if (budget.includes('500,000 - 1,000,000')) return 750000;
  if (budget.includes('> 1,000,000')) return 1500000;
  return 25000; // < 50K
}

// ══════════════════════════════════════════════════════════════
// Notify Sales Managers + Admins directly (no SQS needed)
// ══════════════════════════════════════════════════════════════

async function notifyManagers(leadId: string, data: any) {
  try {
    const title = '🔔 Lead ใหม่จาก LINE';
    const body = `${data.name || ''}${data.company ? ' (' + data.company + ')' : ''} สนใจ ${data.product || '-'} งบ ${data.budget || '-'}`;
    const meta = JSON.stringify({ leadId, source: 'line', ...data });

    // Get all Admin + Sales Manager users
    const managers = await query(DEFAULT_TENANT,
      `SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE u.tenant_id = $1 AND u.is_active = true AND r.name IN ('Admin', 'Sales Manager')`,
      [DEFAULT_TENANT]);

    for (const mgr of managers.rows) {
      await query(DEFAULT_TENANT,
        `INSERT INTO notifications (tenant_id, user_id, channel, type, title, body, metadata, status) VALUES ($1, $2, 'in_app', 'lead_new', $3, $4, $5, 'pending')`,
        [DEFAULT_TENANT, mgr.id, title, body, meta]);
    }
    console.log(`[LINE] Notified ${managers.rows.length} managers for lead ${leadId}`);
  } catch (e: any) { console.error('[LINE] Notify failed:', e.message); }
}

// ══════════════════════════════════════════════════════════════
// Reply to LINE
// ══════════════════════════════════════════════════════════════

async function replyLine(userId: string, text: string, token: string, quickReply?: any) {
  // Use line-reply Lambda (outside VPC) for push message
  try {
    const { LambdaClient, InvokeCommand } = await import('@aws-sdk/client-lambda');
    const lambda = new LambdaClient({ region: 'ap-southeast-1' });
    const msg: any = { type: 'text', text: text.slice(0, 5000) };
    if (quickReply) msg.quickReply = quickReply;
    await lambda.send(new InvokeCommand({
      FunctionName: 'sf7-prod-line-reply',
      Payload: new TextEncoder().encode(JSON.stringify({ to: userId, messages: [msg], channelToken: token })),
    }));
  } catch (e: any) { console.error('[LINE] Reply failed:', e.message); }
}

async function replyLineFlex(userId: string, messages: any[], token: string) {
  try {
    const { LambdaClient, InvokeCommand } = await import('@aws-sdk/client-lambda');
    const lambda = new LambdaClient({ region: 'ap-southeast-1' });
    await lambda.send(new InvokeCommand({
      FunctionName: 'sf7-prod-line-reply',
      Payload: new TextEncoder().encode(JSON.stringify({ to: userId, messages, channelToken: token })),
    }));
  } catch (e: any) { console.error('[LINE] Flex reply failed:', e.message); }
}
