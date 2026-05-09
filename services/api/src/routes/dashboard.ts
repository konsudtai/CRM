/**
 * Dashboard routes — KPI, pipeline summary, revenue, all from real DB.
 */
import { Hono } from 'hono';
import { query } from '../lib/db.js';
import { authMiddleware, requireRole, type TokenPayload } from '../lib/auth.js';

const dashboard = new Hono();
dashboard.use('*', authMiddleware);

// ── DELETE /dashboard/users/:id ── (Admin only)
dashboard.delete('/users/:id', async (c) => {
  const user = c.get('user') as TokenPayload;
  if (!user.roles.includes('Admin')) return c.json({ message: 'Only Admin can delete users' }, 403);

  const t = c.get('tenantId');
  const id = c.req.param('id');

  // Prevent self-delete
  if (id === user.sub) return c.json({ message: 'Cannot delete yourself' }, 400);

  try {
    // Unassign leads and tasks before deleting
    await query(t, 'UPDATE leads SET assigned_to = NULL WHERE assigned_to = $1 AND tenant_id = $2', [id, t]);
    await query(t, 'UPDATE tasks SET assigned_to = NULL WHERE assigned_to = $1 AND tenant_id = $2', [id, t]);
    await query(t, 'UPDATE accounts SET account_owner = NULL WHERE account_owner = $1 AND tenant_id = $2', [id, t]);
    // Delete user_roles (foreign key)
    await query(t, 'DELETE FROM user_roles WHERE user_id = $1', [id]);
    // Delete the user
    const r = await query(t, 'DELETE FROM users WHERE id = $1 AND tenant_id = $2 RETURNING id, email, first_name, last_name', [id, t]);
    if (r.rows.length === 0) return c.json({ message: 'User not found' }, 404);
    return c.json({ message: 'User deleted successfully', user: r.rows[0] });
  } catch (err: any) {
    console.error('Delete user error:', err.message);
    return c.json({ message: 'Failed to delete user: ' + (err.message || '').slice(0, 100) }, 500);
  }
});

// ── PATCH /dashboard/users/:id ── (Admin only — edit user)
dashboard.patch('/users/:id', async (c) => {
  const user = c.get('user') as TokenPayload;
  if (!user.roles.includes('Admin')) return c.json({ message: 'Only Admin can edit users' }, 403);

  const t = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({})) as any;

  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (body.first_name !== undefined) { sets.push(`first_name=$${idx}`); vals.push(body.first_name); idx++; }
  if (body.last_name !== undefined) { sets.push(`last_name=$${idx}`); vals.push(body.last_name); idx++; }
  if (body.email !== undefined) { sets.push(`email=$${idx}`); vals.push(body.email); idx++; }
  if (body.phone !== undefined) { sets.push(`phone=$${idx}`); vals.push(body.phone); idx++; }
  if (body.is_active !== undefined) { sets.push(`is_active=$${idx}`); vals.push(body.is_active); idx++; }

  if (sets.length === 0) return c.json({ message: 'No fields to update' }, 400);

  sets.push('updated_at=NOW()');
  vals.push(id);
  vals.push(t);

  const r = await query(t, `UPDATE users SET ${sets.join(',')} WHERE id=$${idx} AND tenant_id=$${idx+1} RETURNING id, email, first_name, last_name, phone, is_active`, vals);
  if (r.rows.length === 0) return c.json({ message: 'User not found' }, 404);

  // Update role if provided
  if (body.role) {
    const roleR = await query(t, `SELECT id FROM roles WHERE name=$1 AND tenant_id=$2`, [body.role, t]);
    if (roleR.rows.length > 0) {
      await query(t, `DELETE FROM user_roles WHERE user_id=$1`, [id]);
      await query(t, `INSERT INTO user_roles(user_id, role_id) VALUES($1, $2)`, [id, roleR.rows[0].id]);
    }
  }

  return c.json({ message: 'User updated', user: r.rows[0] });
});

// ── PUT /dashboard/users/:id/deactivate ──
dashboard.put('/users/:id/deactivate', async (c) => {
  const t = c.get('tenantId');
  const id = c.req.param('id');
  const r = await query(t, 'UPDATE users SET is_active = false WHERE id = $1 AND tenant_id = $2 RETURNING id, email, first_name, last_name, is_active', [id, t]);
  if (r.rows.length === 0) return c.json({ message: 'User not found' }, 404);
  return c.json({ message: 'User deactivated', user: r.rows[0] });
});

// ── PUT /dashboard/users/:id/activate ──
dashboard.put('/users/:id/activate', async (c) => {
  const t = c.get('tenantId');
  const id = c.req.param('id');
  const r = await query(t, 'UPDATE users SET is_active = true WHERE id = $1 AND tenant_id = $2 RETURNING id, email, first_name, last_name, is_active', [id, t]);
  if (r.rows.length === 0) return c.json({ message: 'User not found' }, 404);
  return c.json({ message: 'User activated', user: r.rows[0] });
});

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
// Returns opportunities + leads grouped by stage/status for Kanban view
dashboard.get('/opportunities', async (c) => {
  const t = c.get('tenantId');

  // Real opportunities
  const r = await query(t,
    `SELECT o.id, o.deal_name as n, a.company_name as c, o.estimated_value as a,
            ps.name as stage, to_char(o.expected_close_date, 'DD Mon') as d
     FROM opportunities o
     JOIN pipeline_stages ps ON ps.id = o.stage_id
     LEFT JOIN accounts a ON a.id = o.account_id
     WHERE o.tenant_id = $1
     ORDER BY ps.sort_order, o.estimated_value DESC`, [t]);

  // Group opportunities by stage
  const grouped: Record<string, any[]> = {};
  for (const row of r.rows) {
    if (!grouped[row.stage]) grouped[row.stage] = [];
    grouped[row.stage].push({ n: row.n, c: row.c, a: parseFloat(row.a), d: row.d });
  }

  // Also include leads grouped by status
  const leads = await query(t,
    `SELECT l.id, l.name as n, l.company_name as c, l.status,
            COALESCE((l.metadata->>'estimatedValue')::numeric, 0) as a,
            to_char(l.created_at, 'DD Mon') as d
     FROM leads l WHERE l.tenant_id = $1
     ORDER BY l.created_at DESC`, [t]);

  // Map lead statuses to pipeline stage names
  const statusToStage: Record<string, string> = {
    New: 'New Lead', Contacted: 'Qualification', Qualified: 'Needs Analysis',
    Proposal: 'Proposal', Negotiation: 'Negotiation', Won: 'Closed Won', Lost: 'Closed Lost',
  };

  for (const lead of leads.rows) {
    const stage = statusToStage[lead.status] || lead.status;
    if (!grouped[stage]) grouped[stage] = [];
    grouped[stage].push({ n: lead.n, c: lead.c || '', a: parseFloat(lead.a), d: lead.d });
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

// ── GET /dashboard/rep-performance ──
dashboard.get('/rep-performance', async (c) => {
  const t = c.get('tenantId');
  const period = c.req.query('period') || 'month';

  let dateFilter: string;
  if (period === 'year') dateFilter = "date_trunc('year', NOW())";
  else if (period === 'quarter') dateFilter = "date_trunc('quarter', NOW())";
  else dateFilter = "date_trunc('month', NOW())";

  const r = await query(t,
    `SELECT
       u.id as user_id,
       u.first_name || ' ' || u.last_name as name,
       COUNT(CASE WHEN o.closed_reason = 'won' AND o.updated_at >= ${dateFilter} THEN 1 END) as deals,
       COALESCE(SUM(CASE WHEN o.closed_reason = 'won' AND o.updated_at >= ${dateFilter} THEN o.estimated_value END), 0) as revenue,
       (SELECT count(*) FROM activities a WHERE a.user_id = u.id AND a.tenant_id = $1 AND a.timestamp >= ${dateFilter}) as activities
     FROM users u
     LEFT JOIN opportunities o ON o.assigned_to = u.id AND o.tenant_id = u.tenant_id
     WHERE u.tenant_id = $1 AND u.is_active = true
     GROUP BY u.id, u.first_name, u.last_name
     HAVING COUNT(CASE WHEN o.closed_reason = 'won' AND o.updated_at >= ${dateFilter} THEN 1 END) > 0
        OR (SELECT count(*) FROM activities a WHERE a.user_id = u.id AND a.tenant_id = $1 AND a.timestamp >= ${dateFilter}) > 0
     ORDER BY revenue DESC
     LIMIT 10`,
    [t]
  );

  return c.json(r.rows.map((row: any) => ({
    name: row.name || 'Unknown',
    deals: parseInt(row.deals),
    revenue: parseFloat(row.revenue),
    activities: parseInt(row.activities),
  })));
});

// ── GET /dashboard/pipeline-stages ──
// Combines pipeline_stages (opportunities) + leads by status for full pipeline view
dashboard.get('/pipeline-stages', async (c) => {
  const t = c.get('tenantId');

  // 1. Opportunity pipeline stages
  const oppStages = await query(t,
    `SELECT ps.name, ps.color, ps.probability, ps.sort_order,
       count(o.id) as deal_count,
       COALESCE(sum(o.estimated_value), 0) as total_value,
       COALESCE(sum(o.estimated_value * ps.probability / 100.0), 0) as weighted_value
     FROM pipeline_stages ps
     LEFT JOIN opportunities o ON o.stage_id = ps.id AND o.tenant_id = ps.tenant_id
     WHERE ps.tenant_id = $1
     GROUP BY ps.id ORDER BY ps.sort_order`,
    [t]
  );

  // 2. Lead pipeline (grouped by status)
  const leadStages = await query(t,
    `SELECT status as name, count(*) as deal_count,
       COALESCE(sum((metadata->>'estimatedValue')::numeric), 0) as total_value
     FROM leads WHERE tenant_id = $1
     GROUP BY status ORDER BY
       CASE status
         WHEN 'New' THEN 1 WHEN 'Contacted' THEN 2 WHEN 'Qualified' THEN 3
         WHEN 'Proposal' THEN 4 WHEN 'Negotiation' THEN 5 WHEN 'Won' THEN 6 WHEN 'Lost' THEN 7
         ELSE 8 END`,
    [t]
  );

  const leadColors: Record<string, string> = {
    New: '#64748B', Contacted: '#0176D3', Qualified: '#0B827C',
    Proposal: '#D97706', Negotiation: '#DC2626', Won: '#2E844A', Lost: '#9CA3AF',
  };

  // Merge: opportunity stages + lead stages (avoid duplicates by name)
  const oppNames = new Set(oppStages.rows.map((r: any) => r.name));
  const merged = [
    ...oppStages.rows.map((row: any) => ({
      name: row.name,
      color: row.color,
      dealCount: parseInt(row.deal_count),
      totalValue: parseFloat(row.total_value),
      weightedValue: parseFloat(row.weighted_value),
    })),
    ...leadStages.rows
      .filter((r: any) => !oppNames.has(r.name))
      .map((row: any) => ({
        name: row.name + ' (Lead)',
        color: leadColors[row.name] || '#6B7280',
        dealCount: parseInt(row.deal_count),
        totalValue: parseFloat(row.total_value),
        weightedValue: 0,
      })),
  ];

  // Also inject lead counts into matching opportunity stages
  const leadMap = new Map(leadStages.rows.map((r: any) => [r.name, r]));
  for (const stage of merged) {
    // Match lead status to pipeline stage name (e.g. "Qualified" lead → "Qualification" stage)
    const matchingLead = leadMap.get(stage.name) ||
      (stage.name === 'New Lead' ? leadMap.get('New') : null) ||
      (stage.name === 'Qualification' ? leadMap.get('Qualified') : null) ||
      (stage.name === 'Needs Analysis' ? leadMap.get('Qualified') : null) ||
      (stage.name === 'Closed Won' ? leadMap.get('Won') : null) ||
      (stage.name === 'Closed Lost' ? leadMap.get('Lost') : null);
    if (matchingLead && stage.dealCount === 0) {
      stage.dealCount += parseInt(matchingLead.deal_count);
      stage.totalValue += parseFloat(matchingLead.total_value || '0');
    }
  }

  return c.json(merged);
});

export default dashboard;
