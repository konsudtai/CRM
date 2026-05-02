/**
 * Dashboard routes — KPI, pipeline summary, revenue, all from real DB.
 */
import { Hono } from 'hono';
import { query } from '../lib/db.js';
import { authMiddleware } from '../lib/auth.js';

const dashboard = new Hono();
dashboard.use('*', authMiddleware);

// ── GET /dashboard/kpi ──
dashboard.get('/kpi', async (c) => {
  const t = c.get('tenantId');
  const period = c.req.query('period') || 'month';

  let dateFilter: string;
  if (period === 'year') dateFilter = "date_trunc('year', NOW())";
  else if (period === 'quarter') dateFilter = "date_trunc('quarter', NOW())";
  else dateFilter = "date_trunc('month', NOW())";

  // Closed won revenue
  const wonR = await query(t,
    `SELECT COALESCE(SUM(estimated_value), 0) as closed
     FROM opportunities WHERE tenant_id = $1 AND closed_reason = 'won' AND updated_at >= ${dateFilter}`, [t]);

  // Target
  const targetR = await query(t,
    `SELECT COALESCE(SUM(target_amount), 0) as target FROM sales_targets WHERE tenant_id = $1`, [t]);

  // New leads this period
  const leadsR = await query(t,
    `SELECT count(*) as leads FROM leads WHERE tenant_id = $1 AND created_at >= ${dateFilter}`, [t]);

  // Conversion rate
  const totalLeads = await query(t, 'SELECT count(*) as c FROM leads WHERE tenant_id = $1', [t]);
  const wonLeads = await query(t, "SELECT count(*) as c FROM leads WHERE tenant_id = $1 AND status = 'Won'", [t]);
  const total = parseInt(totalLeads.rows[0].c);
  const won = parseInt(wonLeads.rows[0].c);
  const conv = total > 0 ? Math.round((won / total) * 1000) / 10 : 0;

  // Active customers
  const activeR = await query(t,
    "SELECT count(*) as c FROM accounts WHERE tenant_id = $1 AND account_status = 'active' AND deleted_at IS NULL", [t]);

  // Open tickets (tasks)
  const ticketsR = await query(t,
    "SELECT count(*) as c FROM tasks WHERE tenant_id = $1 AND status != 'Completed'", [t]);

  return c.json({
    month: {
      closed: parseFloat(wonR.rows[0].closed),
      target: parseFloat(targetR.rows[0].target),
      leads: parseInt(leadsR.rows[0].leads),
      conv,
    },
    quarter: { closed: parseFloat(wonR.rows[0].closed), target: parseFloat(targetR.rows[0].target), leads: parseInt(leadsR.rows[0].leads), conv },
    year: { closed: parseFloat(wonR.rows[0].closed), target: parseFloat(targetR.rows[0].target), leads: parseInt(leadsR.rows[0].leads), conv },
    activeCustomers: parseInt(activeR.rows[0].c),
    openTickets: parseInt(ticketsR.rows[0].c),
  });
});

// ── GET /dashboard/opportunities ──
dashboard.get('/opportunities', async (c) => {
  const t = c.get('tenantId');
  const r = await query(t,
    `SELECT o.id, o.deal_name as n, a.company_name as c, o.estimated_value as a,
            ps.name as stage, to_char(o.expected_close_date, 'DD Mon') as d
     FROM opportunities o
     JOIN pipeline_stages ps ON ps.id = o.stage_id
     LEFT JOIN accounts a ON a.id = o.account_id
     WHERE o.tenant_id = $1
     ORDER BY ps.sort_order, o.estimated_value DESC`, [t]);

  // Group by stage
  const grouped: Record<string, any[]> = {};
  for (const row of r.rows) {
    if (!grouped[row.stage]) grouped[row.stage] = [];
    grouped[row.stage].push({ n: row.n, c: row.c, a: parseFloat(row.a), d: row.d });
  }
  return c.json(grouped);
});

// ── GET /dashboard/customers ──
dashboard.get('/customers', async (c) => {
  const t = c.get('tenantId');
  const r = await query(t,
    `SELECT a.company_name as n, a.account_status as s,
            COALESCE(a.total_revenue, 0) as r,
            to_char(a.last_activity_at, 'DD Mon YYYY') as l,
            (SELECT first_name || ' ' || last_name FROM contacts WHERE account_id = a.id AND is_primary = true LIMIT 1) as c
     FROM accounts a WHERE a.tenant_id = $1 AND a.deleted_at IS NULL
     ORDER BY a.total_revenue DESC NULLS LAST LIMIT 10`, [t]);
  return c.json(r.rows.map((row: any) => ({
    n: row.n, c: row.c || '', s: row.s || 'Active', r: parseFloat(row.r), l: row.l || ''
  })));
});

// ── GET /dashboard/activities ──
dashboard.get('/activities', async (c) => {
  const t = c.get('tenantId');
  const r = await query(t,
    `SELECT summary as title, user_id,
            to_char(timestamp, 'HH24:MI') as "when",
            metadata
     FROM activities WHERE tenant_id = $1 ORDER BY timestamp DESC LIMIT 10`, [t]);
  return c.json(r.rows);
});

// ── GET /dashboard/revenue ──
dashboard.get('/revenue', async (c) => {
  const t = c.get('tenantId');
  const year = parseInt(c.req.query('year') || String(new Date().getFullYear()));

  const r = await query(t,
    `SELECT EXTRACT(MONTH FROM updated_at) as month, COALESCE(SUM(estimated_value), 0) as total
     FROM opportunities
     WHERE tenant_id = $1 AND closed_reason = 'won' AND EXTRACT(YEAR FROM updated_at) = $2
     GROUP BY EXTRACT(MONTH FROM updated_at) ORDER BY month`, [t, year]);

  const monthly = Array(12).fill(0);
  for (const row of r.rows) {
    monthly[parseInt(row.month) - 1] = parseFloat(row.total) / 1000000; // in millions
  }
  return c.json({ monthly });
});

export default dashboard;
