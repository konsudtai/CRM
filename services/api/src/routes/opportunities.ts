import { Hono } from 'hono';
import { query } from '../lib/db.js';
import { authMiddleware } from '../lib/auth.js';

const opportunities = new Hono();
opportunities.use('*', authMiddleware);

opportunities.get('/', async (c) => {
  const t = c.get('tenantId');
  const stageId = c.req.query('stageId');
  const limit = parseInt(c.req.query('limit') || '50');
  let where = 'o.tenant_id = $1';
  const params: any[] = [t];
  if (stageId) { where += ` AND o.stage_id = $2`; params.push(stageId); }
  params.push(limit);
  const r = await query(t,
    `SELECT o.*, ps.name as stage_name, ps.color as stage_color, ps.probability as stage_probability,
            a.company_name as account_name
     FROM opportunities o
     JOIN pipeline_stages ps ON ps.id = o.stage_id
     LEFT JOIN accounts a ON a.id = o.account_id
     WHERE ${where} ORDER BY o.created_at DESC LIMIT $${params.length}`, params);
  return c.json(r.rows);
});

opportunities.get('/:id', async (c) => {
  const t = c.get('tenantId');
  const r = await query(t,
    `SELECT o.*, ps.name as stage_name FROM opportunities o JOIN pipeline_stages ps ON ps.id = o.stage_id WHERE o.id = $1`, [c.req.param('id')]);
  if (r.rows.length === 0) return c.json({ message: 'Not found' }, 404);
  const history = await query(t, 'SELECT * FROM opportunity_histories WHERE opportunity_id = $1 ORDER BY changed_at DESC', [c.req.param('id')]);
  return c.json({ ...r.rows[0], history: history.rows });
});

opportunities.post('/', async (c) => {
  const t = c.get('tenantId');
  const b = await c.req.json().catch(() => ({}));
  if (!b.dealName || !b.accountId || !b.stageId) return c.json({ message: 'dealName, accountId, stageId required' }, 400);

  // Get stage probability for weighted value
  const stageR = await query(t, 'SELECT probability FROM pipeline_stages WHERE id = $1', [b.stageId]);
  const prob = stageR.rows[0]?.probability || 0;
  const weighted = (b.estimatedValue || 0) * prob / 100;

  const r = await query(t,
    `INSERT INTO opportunities (tenant_id, deal_name, account_id, contact_id, estimated_value, stage_id, weighted_value, expected_close_date, assigned_to)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [t, b.dealName, b.accountId, b.contactId||null, b.estimatedValue||0, b.stageId, weighted, b.expectedCloseDate||null, b.assignedTo]);
  return c.json(r.rows[0], 201);
});

opportunities.patch('/:id', async (c) => {
  const t = c.get('tenantId');
  const id = c.req.param('id');
  const userId = c.get('userId');
  const b = await c.req.json().catch(() => ({}));

  // Get current values for history
  const current = await query(t, 'SELECT * FROM opportunities WHERE id = $1', [id]);
  if (current.rows.length === 0) return c.json({ message: 'Not found' }, 404);
  const old = current.rows[0];

  const sets: string[] = []; const vals: any[] = []; let i = 1;
  const mapping: Record<string, string> = {
    dealName: 'deal_name', estimatedValue: 'estimated_value', stageId: 'stage_id',
    expectedCloseDate: 'expected_close_date', assignedTo: 'assigned_to',
    closedReason: 'closed_reason', closedNotes: 'closed_notes',
  };

  for (const [k, v] of Object.entries(b)) {
    const col = mapping[k];
    if (col) { sets.push(`${col} = $${i}`); vals.push(v); i++; }
  }
  if (!sets.length) return c.json({ message: 'No fields' }, 400);

  // Recalculate weighted value if stage changed
  if (b.stageId) {
    const stageR = await query(t, 'SELECT probability FROM pipeline_stages WHERE id = $1', [b.stageId]);
    const prob = stageR.rows[0]?.probability || 0;
    const estVal = b.estimatedValue || old.estimated_value;
    sets.push(`weighted_value = $${i}`); vals.push(estVal * prob / 100); i++;
  }

  sets.push('updated_at = NOW()');
  vals.push(id);
  const r = await query(t, `UPDATE opportunities SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals);

  // Log history for key field changes
  for (const [k, v] of Object.entries(b)) {
    const col = mapping[k];
    if (col && old[col.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase())] !== v) {
      await query(t,
        `INSERT INTO opportunity_histories (opportunity_id, field_name, old_value, new_value, changed_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [id, k, String(old[col] ?? ''), String(v), userId]);
    }
  }

  return c.json(r.rows[0]);
});

export default opportunities;
