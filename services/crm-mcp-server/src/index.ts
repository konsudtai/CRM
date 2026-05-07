/**
 * SalesFAST 7 — CRM MCP Server
 *
 * Exposes CRM database as MCP tools for AI Agents.
 * All agents (น้องแอ๊ด, น้องขายไว, น้องวิ) use this to query/write CRM data.
 *
 * Architecture:
 *   Agent (Strands SDK) → MCP Protocol → This Server → PostgreSQL (RDS)
 *
 * Tools provided:
 *   - Leads: get, search, create, update
 *   - Accounts: get, search, detail
 *   - Users/Sales Reps: list, get detail
 *   - Tasks: get, create, update
 *   - Quotations: get, search
 *   - Pipeline: stages, summary
 *   - KPI: summary, revenue, forecast
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Pool } from 'pg';
import { z } from 'zod';

// ── Database Connection ──
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'salesfast7',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'salesfast7',
  ssl: process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : undefined,
  max: 5,
});

async function query(tenantId: string, sql: string, params: any[] = []) {
  const client = await pool.connect();
  try {
    await client.query(`SET app.current_tenant = '${tenantId}'`);
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// ── MCP Server ──
const server = new McpServer({
  name: 'sf7-crm-mcp-server',
  version: '1.0.0',
});

// ════════════════════════════════════════════
// LEADS
// ════════════════════════════════════════════

server.tool(
  'get_leads',
  'ค้นหา Leads ทั้งหมด — filter ตาม status, assigned_to, search keyword. ใช้เมื่อต้องการดูรายการ Lead',
  {
    tenantId: z.string().describe('Tenant ID'),
    status: z.string().optional().describe('Filter: New, Contacted, Qualified, Proposal, Negotiation, Won, Lost'),
    assignedTo: z.string().optional().describe('Filter by Sales Rep user ID'),
    search: z.string().optional().describe('Search by name, company, email, phone'),
    limit: z.number().optional().default(20).describe('Max results'),
  },
  async ({ tenantId, status, assignedTo, search, limit }) => {
    let where = 'tenant_id = $1';
    const params: any[] = [tenantId];
    let idx = 2;
    if (status) { where += ` AND status = $${idx}`; params.push(status); idx++; }
    if (assignedTo) { where += ` AND assigned_to = $${idx}`; params.push(assignedTo); idx++; }
    if (search) { where += ` AND (name ILIKE $${idx} OR company_name ILIKE $${idx} OR email ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
    params.push(limit);
    const rows = await query(tenantId, `SELECT id, name, company_name, email, phone, status, source, assigned_to, ai_score, metadata, created_at FROM leads WHERE ${where} ORDER BY created_at DESC LIMIT $${idx}`, params);
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  }
);

server.tool(
  'get_lead_detail',
  'ดูรายละเอียด Lead พร้อมข้อมูล Sales Rep ที่ดูแล (ชื่อ, เบอร์, email). ใช้เมื่อลูกค้าถามว่าใครดูแลอยู่',
  {
    tenantId: z.string(),
    leadId: z.string().optional().describe('Lead ID'),
    search: z.string().optional().describe('ค้นหาด้วยชื่อ/บริษัท/เบอร์โทร'),
  },
  async ({ tenantId, leadId, search }) => {
    let rows;
    if (leadId) {
      rows = await query(tenantId, `
        SELECT l.*, u.first_name as rep_first_name, u.last_name as rep_last_name, u.email as rep_email, u.phone as rep_phone, u.line_id as rep_line_id
        FROM leads l LEFT JOIN users u ON u.id = l.assigned_to
        WHERE l.id = $1 AND l.tenant_id = $2`, [leadId, tenantId]);
    } else if (search) {
      rows = await query(tenantId, `
        SELECT l.*, u.first_name as rep_first_name, u.last_name as rep_last_name, u.email as rep_email, u.phone as rep_phone, u.line_id as rep_line_id
        FROM leads l LEFT JOIN users u ON u.id = l.assigned_to
        WHERE l.tenant_id = $1 AND (l.name ILIKE $2 OR l.company_name ILIKE $2 OR l.phone ILIKE $2)
        ORDER BY l.created_at DESC LIMIT 5`, [tenantId, `%${search}%`]);
    } else {
      return { content: [{ type: 'text', text: 'Please provide leadId or search term' }] };
    }
    if (!rows.length) return { content: [{ type: 'text', text: 'Lead not found' }] };
    const result = rows.map(r => ({
      lead: { id: r.id, name: r.name, company: r.company_name, status: r.status, phone: r.phone, email: r.email, source: r.source, metadata: r.metadata },
      salesRep: r.rep_first_name ? { name: `${r.rep_first_name} ${r.rep_last_name}`.trim(), email: r.rep_email, phone: r.rep_phone, lineId: r.rep_line_id } : null,
    }));
    return { content: [{ type: 'text', text: JSON.stringify(result.length === 1 ? result[0] : result, null, 2) }] };
  }
);

server.tool(
  'create_lead',
  'สร้าง Lead ใหม่ในระบบ CRM',
  {
    tenantId: z.string(),
    name: z.string().describe('ชื่อผู้ติดต่อ'),
    companyName: z.string().optional().describe('ชื่อบริษัท'),
    email: z.string().optional(),
    phone: z.string().optional(),
    source: z.string().optional().default('ai_chat').describe('แหล่งที่มา'),
    metadata: z.string().optional().describe('JSON metadata: estimatedValue, projectName, notes'),
  },
  async ({ tenantId, name, companyName, email, phone, source, metadata }) => {
    const meta = metadata ? JSON.parse(metadata) : {};
    const rows = await query(tenantId, `
      INSERT INTO leads (tenant_id, name, company_name, email, phone, source, status, metadata)
      VALUES ($1,$2,$3,$4,$5,$6,'New',$7) RETURNING id, name, status`, 
      [tenantId, name, companyName || null, email || null, phone || null, source, JSON.stringify(meta)]);
    return { content: [{ type: 'text', text: `Lead created: ${JSON.stringify(rows[0])}` }] };
  }
);

server.tool(
  'update_lead',
  'อัพเดท Lead — เปลี่ยน status, assign, หรือแก้ไขข้อมูล',
  {
    tenantId: z.string(),
    leadId: z.string(),
    status: z.string().optional().describe('New, Contacted, Qualified, Proposal, Negotiation, Won, Lost'),
    assignedTo: z.string().optional().describe('User ID ของ Sales Rep'),
    metadata: z.string().optional().describe('JSON metadata to merge'),
  },
  async ({ tenantId, leadId, status, assignedTo, metadata }) => {
    const sets: string[] = []; const vals: any[] = []; let idx = 1;
    if (status) { sets.push(`status = $${idx}`); vals.push(status); idx++; }
    if (assignedTo) { sets.push(`assigned_to = $${idx}`); vals.push(assignedTo); idx++; }
    if (metadata) { sets.push(`metadata = metadata || $${idx}::jsonb`); vals.push(metadata); idx++; }
    if (!sets.length) return { content: [{ type: 'text', text: 'No fields to update' }] };
    sets.push('updated_at = NOW()');
    vals.push(leadId);
    const rows = await query(tenantId, `UPDATE leads SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, name, status, assigned_to`, vals);
    return { content: [{ type: 'text', text: `Lead updated: ${JSON.stringify(rows[0])}` }] };
  }
);

// ════════════════════════════════════════════
// ACCOUNTS (Customers)
// ════════════════════════════════════════════

server.tool(
  'get_accounts',
  'ค้นหาลูกค้า (Accounts) — ตามชื่อ, สถานะ, tier',
  {
    tenantId: z.string(),
    search: z.string().optional().describe('ชื่อบริษัท, เบอร์, tax ID'),
    status: z.string().optional().describe('active, inactive, prospect, churned'),
    limit: z.number().optional().default(10),
  },
  async ({ tenantId, search, status, limit }) => {
    let where = 'tenant_id = $1 AND deleted_at IS NULL';
    const params: any[] = [tenantId]; let idx = 2;
    if (search) { where += ` AND (company_name ILIKE $${idx} OR phone ILIKE $${idx} OR tax_id ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
    if (status) { where += ` AND account_status = $${idx}`; params.push(status); idx++; }
    params.push(limit);
    const rows = await query(tenantId, `SELECT id, company_name, account_status, account_tier, phone, email, total_revenue, total_deals, industry FROM accounts WHERE ${where} ORDER BY total_revenue DESC NULLS LAST LIMIT $${idx}`, params);
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  }
);

server.tool(
  'get_account_detail',
  'ดูรายละเอียดลูกค้า — ข้อมูลบริษัท, contacts, owner (Sales Rep)',
  {
    tenantId: z.string(),
    accountId: z.string(),
  },
  async ({ tenantId, accountId }) => {
    const account = await query(tenantId, `SELECT a.*, u.first_name as owner_first, u.last_name as owner_last, u.phone as owner_phone, u.email as owner_email FROM accounts a LEFT JOIN users u ON u.id = a.account_owner WHERE a.id = $1`, [accountId]);
    const contacts = await query(tenantId, `SELECT first_name, last_name, title, phone, email, is_primary FROM contacts WHERE account_id = $1 AND is_active = true`, [accountId]);
    if (!account.length) return { content: [{ type: 'text', text: 'Account not found' }] };
    return { content: [{ type: 'text', text: JSON.stringify({ account: account[0], contacts }, null, 2) }] };
  }
);

// ════════════════════════════════════════════
// USERS (Sales Reps)
// ════════════════════════════════════════════

server.tool(
  'get_users',
  'ดูรายชื่อ Users/Sales Reps ทั้งหมด — ชื่อ, email, เบอร์, role',
  {
    tenantId: z.string(),
    activeOnly: z.boolean().optional().default(true),
  },
  async ({ tenantId, activeOnly }) => {
    const where = activeOnly ? 'u.tenant_id = $1 AND u.is_active = true' : 'u.tenant_id = $1';
    const rows = await query(tenantId, `
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.line_id, u.is_active,
             (SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id LIMIT 1) as role
      FROM users u WHERE ${where} ORDER BY u.first_name`, [tenantId]);
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  }
);

// ════════════════════════════════════════════
// TASKS
// ════════════════════════════════════════════

server.tool(
  'get_tasks',
  'ดู Tasks — filter ตาม status, assigned_to, overdue',
  {
    tenantId: z.string(),
    assignedTo: z.string().optional(),
    status: z.string().optional().describe('Open, In Progress, Completed'),
    overdueOnly: z.boolean().optional().default(false),
    limit: z.number().optional().default(20),
  },
  async ({ tenantId, assignedTo, status, overdueOnly, limit }) => {
    let where = 't.tenant_id = $1';
    const params: any[] = [tenantId]; let idx = 2;
    if (assignedTo) { where += ` AND t.assigned_to = $${idx}`; params.push(assignedTo); idx++; }
    if (status) { where += ` AND t.status = $${idx}`; params.push(status); idx++; }
    if (overdueOnly) { where += ` AND t.due_date < NOW() AND t.status != 'Completed'`; }
    params.push(limit);
    const rows = await query(tenantId, `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.assigned_to, a.company_name as account_name FROM tasks t LEFT JOIN accounts a ON a.id = t.account_id WHERE ${where} ORDER BY t.due_date ASC NULLS LAST LIMIT $${idx}`, params);
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  }
);

server.tool(
  'create_task',
  'สร้าง Task ใหม่',
  {
    tenantId: z.string(),
    title: z.string(),
    assignedTo: z.string().describe('User ID'),
    dueDate: z.string().describe('YYYY-MM-DD'),
    priority: z.string().optional().default('Medium'),
    description: z.string().optional(),
    accountId: z.string().optional(),
  },
  async ({ tenantId, title, assignedTo, dueDate, priority, description, accountId }) => {
    const rows = await query(tenantId, `
      INSERT INTO tasks (tenant_id, title, description, due_date, priority, status, assigned_to, account_id)
      VALUES ($1,$2,$3,$4,$5,'Open',$6,$7) RETURNING id, title, status, due_date`,
      [tenantId, title, description || null, dueDate, priority, assignedTo, accountId || null]);
    return { content: [{ type: 'text', text: `Task created: ${JSON.stringify(rows[0])}` }] };
  }
);

// ════════════════════════════════════════════
// QUOTATIONS
// ════════════════════════════════════════════

server.tool(
  'get_products',
  'ค้นหาสินค้า/บริการในแคตตาล็อก — ชื่อ, SKU, ราคา, รายละเอียด. ใช้เมื่อลูกค้าถามเกี่ยวกับสินค้าหรือราคา',
  {
    tenantId: z.string(),
    search: z.string().optional().describe('ค้นหาด้วยชื่อสินค้าหรือ SKU'),
    limit: z.number().optional().default(10),
  },
  async ({ tenantId, search, limit }) => {
    let where = 'tenant_id = $1 AND is_active = true';
    const params: any[] = [tenantId]; let idx = 2;
    if (search) { where += ` AND (name ILIKE $${idx} OR sku ILIKE $${idx} OR description ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
    params.push(limit);
    const rows = await query(tenantId, `SELECT id, name, sku, description, unit_price, unit_of_measure, wht_rate FROM products WHERE ${where} ORDER BY name LIMIT $${idx}`, params);
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  }
);

server.tool(
  'get_quotations',
  'ดู Quotations — filter ตาม status',
  {
    tenantId: z.string(),
    status: z.string().optional().describe('draft, pending_approval, sent, accepted, rejected'),
    limit: z.number().optional().default(10),
  },
  async ({ tenantId, status, limit }) => {
    let where = 'q.tenant_id = $1';
    const params: any[] = [tenantId]; let idx = 2;
    if (status) { where += ` AND q.status = $${idx}`; params.push(status); idx++; }
    params.push(limit);
    const rows = await query(tenantId, `SELECT q.id, q.quotation_number, q.status, q.grand_total, q.created_at, a.company_name as account_name FROM quotations q LEFT JOIN accounts a ON a.id = q.account_id WHERE ${where} ORDER BY q.created_at DESC LIMIT $${idx}`, params);
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  }
);

// ════════════════════════════════════════════
// PIPELINE & KPI
// ════════════════════════════════════════════

server.tool(
  'get_pipeline_summary',
  'สรุป Pipeline — จำนวน leads แต่ละ stage + มูลค่ารวม',
  {
    tenantId: z.string(),
  },
  async ({ tenantId }) => {
    const stages = await query(tenantId, `SELECT name, color, sort_order FROM pipeline_stages WHERE tenant_id = $1 ORDER BY sort_order`, [tenantId]);
    const leads = await query(tenantId, `SELECT status, count(*) as count, COALESCE(sum((metadata->>'estimatedValue')::numeric), 0) as total_value FROM leads WHERE tenant_id = $1 GROUP BY status`, [tenantId]);
    return { content: [{ type: 'text', text: JSON.stringify({ stages, leadsByStatus: leads }, null, 2) }] };
  }
);

server.tool(
  'get_kpi_summary',
  'สรุป KPI ทั้งหมด — leads, accounts, deals, tasks, quotations, revenue',
  {
    tenantId: z.string(),
    period: z.string().optional().default('month').describe('month, quarter, year'),
  },
  async ({ tenantId, period }) => {
    let dateFilter: string;
    if (period === 'year') dateFilter = "date_trunc('year', NOW())";
    else if (period === 'quarter') dateFilter = "date_trunc('quarter', NOW())";
    else dateFilter = "date_trunc('month', NOW())";

    const [leads, accounts, tasks, quotations, revenue] = await Promise.all([
      query(tenantId, `SELECT count(*) as total, count(*) FILTER (WHERE created_at >= ${dateFilter}) as new_this_period FROM leads WHERE tenant_id = $1`, [tenantId]),
      query(tenantId, `SELECT count(*) as total FROM accounts WHERE tenant_id = $1 AND deleted_at IS NULL AND account_status = 'active'`, [tenantId]),
      query(tenantId, `SELECT count(*) as total, count(*) FILTER (WHERE status != 'Completed' AND due_date < NOW()) as overdue FROM tasks WHERE tenant_id = $1`, [tenantId]),
      query(tenantId, `SELECT count(*) as total, COALESCE(sum(grand_total), 0) as total_value FROM quotations WHERE tenant_id = $1`, [tenantId]),
      query(tenantId, `SELECT COALESCE(sum(estimated_value), 0) as won_revenue FROM opportunities WHERE tenant_id = $1 AND closed_reason = 'won' AND updated_at >= ${dateFilter}`, [tenantId]),
    ]);

    return { content: [{ type: 'text', text: JSON.stringify({
      leads: leads[0],
      activeAccounts: accounts[0].total,
      tasks: tasks[0],
      quotations: quotations[0],
      wonRevenue: revenue[0].won_revenue,
      period,
    }, null, 2) }] };
  }
);

server.tool(
  'get_sales_rep_performance',
  'ดูผลงาน Sales Rep แต่ละคน — deals, revenue, tasks, leads',
  {
    tenantId: z.string(),
  },
  async ({ tenantId }) => {
    const rows = await query(tenantId, `
      SELECT u.id, u.first_name || ' ' || u.last_name as name, u.email,
        (SELECT count(*) FROM leads l WHERE l.assigned_to = u.id AND l.tenant_id = $1) as total_leads,
        (SELECT count(*) FROM leads l WHERE l.assigned_to = u.id AND l.tenant_id = $1 AND l.status = 'Won') as won_leads,
        (SELECT count(*) FROM tasks t WHERE t.assigned_to = u.id AND t.tenant_id = $1 AND t.status != 'Completed') as open_tasks
      FROM users u WHERE u.tenant_id = $1 AND u.is_active = true
      ORDER BY total_leads DESC`, [tenantId]);
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  }
);

// ════════════════════════════════════════════
// START SERVER
// ════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('CRM MCP Server running on stdio');
}

main().catch(console.error);
