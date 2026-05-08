/**
 * CRM MCP Client — Embedded MCP tools for AgentCore Runtime
 *
 * Instead of spawning a separate MCP server process (which is fragile in containers),
 * we embed the CRM tools directly as Strands SDK tools that query PostgreSQL.
 *
 * This gives us the same functionality as the MCP server but in-process:
 *   Agent → tool call → PostgreSQL query → result
 */
import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { Pool } from 'pg';

// ── Database Connection ──
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'salesfast7',
      password: process.env.DB_PASS,
      database: process.env.DB_NAME || 'salesfast7',
      ssl: process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : undefined,
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

async function query(tenantId: string, sql: string, params: any[] = []): Promise<any[]> {
  const client = await getPool().connect();
  try {
    await client.query(`SET app.current_tenant = '${tenantId}'`);
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// ── MCP Tools (embedded as Strands SDK tools) ──
let mcpTools: any[] = [];

export async function initMcpTools(): Promise<void> {
  if (mcpTools.length > 0) return;

  // Test DB connection
  if (!process.env.DB_HOST) {
    console.warn('[MCP] DB_HOST not set — MCP tools will be unavailable');
    return;
  }

  try {
    const client = await getPool().connect();
    await client.query('SELECT 1');
    client.release();
    console.log('[MCP] Database connected successfully');
  } catch (err: any) {
    console.error('[MCP] Database connection failed:', err.message);
    return;
  }

  mcpTools = createCrmTools();
  console.log(`[MCP] ${mcpTools.length} CRM tools registered`);
}

export function getMcpTools(): any[] {
  return mcpTools;
}

// ══════════════════════════════════════════════════════════════
// CRM Tools Definition
// ══════════════════════════════════════════════════════════════

function createCrmTools(): any[] {
  return [
    // ── LEADS ──
    tool({
      name: 'get_leads',
      description: 'ค้นหา Leads — filter ตาม status, assigned_to, keyword',
      inputSchema: z.object({
        tenantId: z.string(),
        status: z.string().optional().describe('New, Contacted, Qualified, Proposal, Negotiation, Won, Lost'),
        search: z.string().optional().describe('ค้นหาด้วยชื่อ/บริษัท/email'),
        limit: z.number().optional().default(20),
      }),
      handler: async (input: any) => {
        let where = 'tenant_id = $1';
        const params: any[] = [input.tenantId];
        let idx = 2;
        if (input.status) { where += ` AND status = $${idx}`; params.push(input.status); idx++; }
        if (input.search) { where += ` AND (name ILIKE $${idx} OR company_name ILIKE $${idx})`; params.push(`%${input.search}%`); idx++; }
        params.push(input.limit || 20);
        const rows = await query(input.tenantId, `SELECT id, name, company_name, status, source, assigned_to, (metadata->>'estimatedValue') as value, (metadata->>'projectName') as project FROM leads WHERE ${where} ORDER BY created_at DESC LIMIT $${idx}`, params);
        return JSON.stringify(rows, null, 2);
      },
    }),

    tool({
      name: 'get_lead_detail',
      description: 'ดูรายละเอียด Lead + Sales Rep ที่ดูแล — ใช้เมื่อลูกค้าถามว่าใครดูแลอยู่',
      inputSchema: z.object({
        tenantId: z.string(),
        leadId: z.string().optional(),
        search: z.string().optional().describe('ค้นหาด้วยชื่อ/บริษัท/เบอร์'),
      }),
      handler: async (input: any) => {
        let rows;
        if (input.leadId) {
          rows = await query(input.tenantId, `SELECT l.*, u.first_name as rep_first, u.last_name as rep_last, u.email as rep_email, u.phone as rep_phone FROM leads l LEFT JOIN users u ON u.id = l.assigned_to WHERE l.id = $1 AND l.tenant_id = $2`, [input.leadId, input.tenantId]);
        } else if (input.search) {
          rows = await query(input.tenantId, `SELECT l.*, u.first_name as rep_first, u.last_name as rep_last, u.email as rep_email, u.phone as rep_phone FROM leads l LEFT JOIN users u ON u.id = l.assigned_to WHERE l.tenant_id = $1 AND (l.name ILIKE $2 OR l.company_name ILIKE $2 OR l.phone ILIKE $2) LIMIT 5`, [input.tenantId, `%${input.search}%`]);
        } else {
          return 'Please provide leadId or search term';
        }
        return JSON.stringify(rows, null, 2);
      },
    }),

    tool({
      name: 'create_lead',
      description: 'สร้าง Lead ใหม่ในระบบ CRM',
      inputSchema: z.object({
        tenantId: z.string(),
        name: z.string().describe('ชื่อผู้ติดต่อ'),
        companyName: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        source: z.string().optional().default('ai_chat'),
        metadata: z.string().optional().describe('JSON: estimatedValue, projectName, notes'),
      }),
      handler: async (input: any) => {
        const meta = input.metadata ? JSON.parse(input.metadata) : {};
        const rows = await query(input.tenantId, `INSERT INTO leads (tenant_id, name, company_name, email, phone, source, status, metadata) VALUES ($1,$2,$3,$4,$5,$6,'New',$7) RETURNING id, name, status`, [input.tenantId, input.name, input.companyName || null, input.email || null, input.phone || null, input.source || 'ai_chat', JSON.stringify(meta)]);
        return `Lead created: ${JSON.stringify(rows[0])}`;
      },
    }),

    tool({
      name: 'update_lead',
      description: 'อัพเดท Lead — เปลี่ยน status, assign Sales Rep',
      inputSchema: z.object({
        tenantId: z.string(),
        leadId: z.string(),
        status: z.string().optional(),
        assignedTo: z.string().optional().describe('User ID ของ Sales Rep'),
      }),
      handler: async (input: any) => {
        const sets: string[] = []; const vals: any[] = []; let idx = 1;
        if (input.status) { sets.push(`status = $${idx}`); vals.push(input.status); idx++; }
        if (input.assignedTo) { sets.push(`assigned_to = $${idx}`); vals.push(input.assignedTo); idx++; }
        if (!sets.length) return 'No fields to update';
        sets.push('updated_at = NOW()');
        vals.push(input.leadId);
        const rows = await query(input.tenantId, `UPDATE leads SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, name, status, assigned_to`, vals);
        return `Lead updated: ${JSON.stringify(rows[0])}`;
      },
    }),

    // ── ACCOUNTS ──
    tool({
      name: 'get_accounts',
      description: 'ค้นหาลูกค้า (Accounts) — ชื่อ, สถานะ, tier',
      inputSchema: z.object({
        tenantId: z.string(),
        search: z.string().optional(),
        limit: z.number().optional().default(10),
      }),
      handler: async (input: any) => {
        let where = 'tenant_id = $1 AND deleted_at IS NULL';
        const params: any[] = [input.tenantId]; let idx = 2;
        if (input.search) { where += ` AND (company_name ILIKE $${idx} OR phone ILIKE $${idx})`; params.push(`%${input.search}%`); idx++; }
        params.push(input.limit || 10);
        const rows = await query(input.tenantId, `SELECT id, company_name, account_status, account_tier, total_revenue, industry FROM accounts WHERE ${where} ORDER BY total_revenue DESC NULLS LAST LIMIT $${idx}`, params);
        return JSON.stringify(rows, null, 2);
      },
    }),

    tool({
      name: 'get_account_detail',
      description: 'ดูรายละเอียดลูกค้า + contacts + owner',
      inputSchema: z.object({ tenantId: z.string(), accountId: z.string() }),
      handler: async (input: any) => {
        const account = await query(input.tenantId, `SELECT a.*, u.first_name as owner_first, u.last_name as owner_last, u.phone as owner_phone FROM accounts a LEFT JOIN users u ON u.id = a.account_owner WHERE a.id = $1`, [input.accountId]);
        const contacts = await query(input.tenantId, `SELECT first_name, last_name, title, phone, email FROM contacts WHERE account_id = $1 AND is_active = true`, [input.accountId]);
        return JSON.stringify({ account: account[0], contacts }, null, 2);
      },
    }),

    // ── USERS ──
    tool({
      name: 'get_users',
      description: 'ดูรายชื่อ Users/Sales Reps ทั้งหมด',
      inputSchema: z.object({ tenantId: z.string() }),
      handler: async (input: any) => {
        const rows = await query(input.tenantId, `SELECT u.id, u.first_name || ' ' || u.last_name as name, u.email, u.phone, (SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id LIMIT 1) as role FROM users u WHERE u.tenant_id = $1 AND u.is_active = true ORDER BY u.first_name`, [input.tenantId]);
        return JSON.stringify(rows, null, 2);
      },
    }),

    // ── TASKS ──
    tool({
      name: 'get_tasks',
      description: 'ดู Tasks — filter ตาม status, assigned_to, overdue',
      inputSchema: z.object({
        tenantId: z.string(),
        assignedTo: z.string().optional(),
        status: z.string().optional().describe('Open, In Progress, Completed'),
        overdueOnly: z.boolean().optional().default(false),
      }),
      handler: async (input: any) => {
        let where = 't.tenant_id = $1';
        const params: any[] = [input.tenantId]; let idx = 2;
        if (input.assignedTo) { where += ` AND t.assigned_to = $${idx}`; params.push(input.assignedTo); idx++; }
        if (input.status) { where += ` AND t.status = $${idx}`; params.push(input.status); idx++; }
        if (input.overdueOnly) { where += ` AND t.due_date < NOW() AND t.status != 'Completed'`; }
        const rows = await query(input.tenantId, `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.assigned_to FROM tasks t WHERE ${where} ORDER BY t.due_date ASC LIMIT 20`, params);
        return JSON.stringify(rows, null, 2);
      },
    }),

    tool({
      name: 'create_task',
      description: 'สร้าง Task ใหม่',
      inputSchema: z.object({
        tenantId: z.string(),
        title: z.string(),
        assignedTo: z.string(),
        dueDate: z.string().describe('YYYY-MM-DD'),
        priority: z.string().optional().default('Medium'),
      }),
      handler: async (input: any) => {
        const rows = await query(input.tenantId, `INSERT INTO tasks (tenant_id, title, due_date, priority, status, assigned_to) VALUES ($1,$2,$3,$4,'Open',$5) RETURNING id, title, status, due_date`, [input.tenantId, input.title, input.dueDate, input.priority || 'Medium', input.assignedTo]);
        return `Task created: ${JSON.stringify(rows[0])}`;
      },
    }),

    // ── PRODUCTS ──
    tool({
      name: 'get_products',
      description: 'ค้นหาสินค้า/บริการ — ชื่อ, SKU, ราคา',
      inputSchema: z.object({
        tenantId: z.string(),
        search: z.string().optional(),
      }),
      handler: async (input: any) => {
        let where = 'tenant_id = $1 AND is_active = true';
        const params: any[] = [input.tenantId]; let idx = 2;
        if (input.search) { where += ` AND (name ILIKE $${idx} OR sku ILIKE $${idx})`; params.push(`%${input.search}%`); idx++; }
        const rows = await query(input.tenantId, `SELECT id, name, sku, description, unit_price FROM products WHERE ${where} ORDER BY name LIMIT 10`, params);
        return JSON.stringify(rows, null, 2);
      },
    }),

    // ── QUOTATIONS ──
    tool({
      name: 'get_quotations',
      description: 'ดู Quotations — filter ตาม status',
      inputSchema: z.object({
        tenantId: z.string(),
        status: z.string().optional().describe('draft, pending_approval, sent, accepted, rejected'),
      }),
      handler: async (input: any) => {
        let where = 'q.tenant_id = $1';
        const params: any[] = [input.tenantId]; let idx = 2;
        if (input.status) { where += ` AND q.status = $${idx}`; params.push(input.status); idx++; }
        const rows = await query(input.tenantId, `SELECT q.id, q.quotation_number, q.status, q.grand_total, a.company_name FROM quotations q LEFT JOIN accounts a ON a.id = q.account_id WHERE ${where} ORDER BY q.created_at DESC LIMIT 10`, params);
        return JSON.stringify(rows, null, 2);
      },
    }),

    // ── PIPELINE & KPI ──
    tool({
      name: 'get_pipeline_summary',
      description: 'สรุป Pipeline — จำนวน leads แต่ละ stage + มูลค่ารวม',
      inputSchema: z.object({ tenantId: z.string() }),
      handler: async (input: any) => {
        const stages = await query(input.tenantId, `SELECT name, color, sort_order FROM pipeline_stages WHERE tenant_id = $1 ORDER BY sort_order`, [input.tenantId]);
        const leads = await query(input.tenantId, `SELECT status, count(*) as count, COALESCE(sum((metadata->>'estimatedValue')::numeric), 0) as total_value FROM leads WHERE tenant_id = $1 GROUP BY status`, [input.tenantId]);
        return JSON.stringify({ stages, leadsByStatus: leads }, null, 2);
      },
    }),

    tool({
      name: 'get_kpi_summary',
      description: 'สรุป KPI ทั้งหมด — leads, accounts, tasks, quotations, revenue',
      inputSchema: z.object({ tenantId: z.string() }),
      handler: async (input: any) => {
        const [leads, accounts, tasks, quotations] = await Promise.all([
          query(input.tenantId, `SELECT count(*) as total, count(*) FILTER (WHERE status = 'Won') as won FROM leads WHERE tenant_id = $1`, [input.tenantId]),
          query(input.tenantId, `SELECT count(*) as total FROM accounts WHERE tenant_id = $1 AND deleted_at IS NULL AND account_status = 'active'`, [input.tenantId]),
          query(input.tenantId, `SELECT count(*) as total, count(*) FILTER (WHERE status != 'Completed' AND due_date < NOW()) as overdue FROM tasks WHERE tenant_id = $1`, [input.tenantId]),
          query(input.tenantId, `SELECT count(*) as total, COALESCE(sum(grand_total), 0) as total_value FROM quotations WHERE tenant_id = $1`, [input.tenantId]),
        ]);
        return JSON.stringify({ leads: leads[0], activeAccounts: accounts[0].total, tasks: tasks[0], quotations: quotations[0] }, null, 2);
      },
    }),

    tool({
      name: 'get_sales_rep_performance',
      description: 'ดูผลงาน Sales Rep แต่ละคน — leads, won, tasks',
      inputSchema: z.object({ tenantId: z.string() }),
      handler: async (input: any) => {
        const rows = await query(input.tenantId, `SELECT u.id, u.first_name || ' ' || u.last_name as name, (SELECT count(*) FROM leads l WHERE l.assigned_to = u.id) as total_leads, (SELECT count(*) FROM leads l WHERE l.assigned_to = u.id AND l.status = 'Won') as won_leads, (SELECT count(*) FROM tasks t WHERE t.assigned_to = u.id AND t.status != 'Completed') as open_tasks FROM users u WHERE u.tenant_id = $1 AND u.is_active = true ORDER BY total_leads DESC`, [input.tenantId]);
        return JSON.stringify(rows, null, 2);
      },
    }),
  ];
}
