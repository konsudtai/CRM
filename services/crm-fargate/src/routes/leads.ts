/**
 * Lead + Pipeline routes — CRUD, assign, status change, pipeline stages.
 */
import { Hono } from 'hono';
import { query } from '../lib/db.js';
import { authMiddleware } from '../lib/auth.js';

const leads = new Hono();
leads.use('*', authMiddleware);

// ── GET /leads ──
leads.get('/', async (c) => {
  const t = c.get('tenantId');
  const user = c.get('user') as any;
  const status = c.req.query('status');
  const assignedTo = c.req.query('assignedTo');
  const search = c.req.query('search');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');

  let where = 'tenant_id = $1';
  const params: any[] = [t];
  let idx = 2;

  // Sales Rep can only see their own leads
  const isManager = user.roles && (user.roles.includes('Admin') || user.roles.includes('Sales Manager'));
  if (!isManager && !assignedTo) {
    where += ` AND assigned_to = $${idx}`;
    params.push(user.sub);
    idx++;
  }

  if (status) { where += ` AND status = $${idx}`; params.push(status); idx++; }
  if (assignedTo) { where += ` AND assigned_to = $${idx}`; params.push(assignedTo); idx++; }
  if (search) { where += ` AND (name ILIKE $${idx} OR company_name ILIKE $${idx} OR email ILIKE $${idx} OR phone ILIKE $${idx} OR metadata::text ILIKE $${idx})`; params.push(`%${search}%`); idx++; }

  const countR = await query(t, `SELECT count(*) FROM leads WHERE ${where}`, params);
  const dataParams = [...params, limit, (page - 1) * limit];
  const dataR = await query(t, `SELECT * FROM leads WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, dataParams);

  return c.json({ data: dataR.rows, total: parseInt(countR.rows[0].count), page, limit });
});

// ── GET /leads/:id ──
leads.get('/:id', async (c) => {
  const t = c.get('tenantId');
  const r = await query(t, 'SELECT * FROM leads WHERE id = $1', [c.req.param('id')]);
  if (r.rows.length === 0) return c.json({ message: 'Lead not found' }, 404);
  return c.json(r.rows[0]);
});

// ── POST /leads ──
leads.post('/', async (c) => {
  const t = c.get('tenantId');
  const userId = c.get('userId');
  const b = await c.req.json().catch(() => ({}));
  if (!b.name) return c.json({ message: 'name is required' }, 400);

  const assignedTo = b.assignedTo || userId;

  // Generate lead_code (L-0001, L-0002, ...)
  await query(t, `INSERT INTO lead_sequences (tenant_id, current_value) VALUES ($1, 0) ON CONFLICT (tenant_id) DO NOTHING`, [t]);
  const seqRes = await query(t, `UPDATE lead_sequences SET current_value = current_value + 1 WHERE tenant_id = $1 RETURNING current_value`, [t]);
  const leadCode = 'L-' + String(seqRes.rows[0].current_value).padStart(4, '0');

  const r = await query(t,
    `INSERT INTO leads (tenant_id, name, company_name, email, phone, line_id, source, status, assigned_to, metadata, lead_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'New',$8,$9,$10) RETURNING *`,
    [t, b.name, b.companyName||null, b.email||null, b.phone||null, b.lineId||null,
     b.source||'manual', assignedTo, JSON.stringify(b.metadata||{statusHistory:[{status:'New',timestamp:new Date().toISOString()}],createdBy:userId,accountId:b.accountId||null}), leadCode]
  );
  return c.json(r.rows[0], 201);
});

// ── PATCH /leads/:id ──
leads.patch('/:id', async (c) => {
  const t = c.get('tenantId');
  const id = c.req.param('id');
  const b = await c.req.json().catch(() => ({}));

  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  const mapping: Record<string, string> = {
    name: 'name', companyName: 'company_name', email: 'email', phone: 'phone',
    lineId: 'line_id', source: 'source', status: 'status', assignedTo: 'assigned_to',
    aiScore: 'ai_score', metadata: 'metadata',
  };

  for (const [key, val] of Object.entries(b)) {
    const col = mapping[key];
    if (col) {
      fields.push(`${col} = $${idx}`);
      values.push(col === 'metadata' ? JSON.stringify(val) : val);
      idx++;
    }
  }
  if (fields.length === 0) return c.json({ message: 'No fields to update' }, 400);

  fields.push('updated_at = NOW()');
  values.push(id);

  // Get old values for history tracking
  const oldLead = await query(t, `SELECT status, assigned_to FROM leads WHERE id = $1`, [id]);

  const r = await query(t, `UPDATE leads SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
  if (r.rows.length === 0) return c.json({ message: 'Lead not found' }, 404);

  // Record changes in lead_histories
  if (oldLead.rows[0]) {
    const old = oldLead.rows[0];
    if (b.status && b.status !== old.status) {
      await query(t, `INSERT INTO lead_histories (lead_id, field_name, old_value, new_value) VALUES ($1, 'status', $2, $3)`, [id, old.status, b.status]).catch(() => {});
    }
    if (b.assignedTo && b.assignedTo !== old.assigned_to) {
      await query(t, `INSERT INTO lead_histories (lead_id, field_name, old_value, new_value) VALUES ($1, 'assigned_to', $2, $3)`, [id, old.assigned_to, b.assignedTo]).catch(() => {});
    }
  }

  return c.json(r.rows[0]);
});

// ── DELETE /leads/:id ──
leads.delete('/:id', async (c) => {
  const t = c.get('tenantId');
  await query(t, 'DELETE FROM leads WHERE id = $1', [c.req.param('id')]);
  return c.json({ message: 'Deleted' });
});

// ── GET /leads/:id/history ──
leads.get('/:id/history', async (c) => {
  const t = c.get('tenantId');
  const id = c.req.param('id');
  const r = await query(t,
    `SELECT lh.*, u.first_name || ' ' || u.last_name as changed_by_name
     FROM lead_histories lh
     LEFT JOIN users u ON u.id = lh.changed_by
     WHERE lh.lead_id = $1
     ORDER BY lh.changed_at ASC`,
    [id]);
  return c.json(r.rows);
});

// ── Pipeline Stages ──
leads.get('/pipeline/stages', async (c) => {
  const t = c.get('tenantId');
  const r = await query(t, 'SELECT * FROM pipeline_stages WHERE tenant_id = $1 ORDER BY sort_order', [t]);
  return c.json(r.rows);
});

// ── Pipeline Summary (for dashboard) ──
leads.get('/pipeline/summary', async (c) => {
  const t = c.get('tenantId');
  const r = await query(t,
    `SELECT ps.name, ps.color, ps.probability, ps.sort_order,
       count(o.id) as deal_count,
       COALESCE(sum(o.estimated_value), 0) as total_value
     FROM pipeline_stages ps
     LEFT JOIN opportunities o ON o.stage_id = ps.id AND o.tenant_id = ps.tenant_id
     WHERE ps.tenant_id = $1
     GROUP BY ps.id ORDER BY ps.sort_order`,
    [t]
  );
  return c.json(r.rows);
});

export default leads;
