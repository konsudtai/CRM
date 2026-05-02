import { Hono } from 'hono';
import { query } from '../lib/db.js';
import { authMiddleware } from '../lib/auth.js';

const tasks = new Hono();
tasks.use('*', authMiddleware);

tasks.get('/', async (c) => {
  const t = c.get('tenantId');
  const status = c.req.query('status');
  const assignedTo = c.req.query('assignedTo');
  const overdue = c.req.query('overdue');
  const limit = parseInt(c.req.query('limit') || '50');

  let where = 'tenant_id = $1';
  const params: any[] = [t];
  let idx = 2;

  if (status) { where += ` AND status = $${idx}`; params.push(status); idx++; }
  if (assignedTo) { where += ` AND assigned_to = $${idx}`; params.push(assignedTo); idx++; }
  if (overdue === 'true') { where += ` AND due_date < CURRENT_DATE AND status != 'Completed'`; }

  params.push(limit);
  const r = await query(t, `SELECT * FROM tasks WHERE ${where} ORDER BY due_date ASC LIMIT $${idx}`, params);
  return c.json(r.rows);
});

tasks.post('/', async (c) => {
  const t = c.get('tenantId');
  const b = await c.req.json().catch(() => ({}));
  if (!b.title) return c.json({ message: 'title required' }, 400);

  const r = await query(t,
    `INSERT INTO tasks (tenant_id, title, description, due_date, priority, status, assigned_to, account_id, opportunity_id)
     VALUES ($1,$2,$3,$4,$5,'Open',$6,$7,$8) RETURNING *`,
    [t, b.title, b.description||null, b.dueDate||null, b.priority||'Medium', b.assignedTo||null, b.accountId||null, b.opportunityId||null]
  );
  return c.json(r.rows[0], 201);
});

tasks.patch('/:id', async (c) => {
  const t = c.get('tenantId');
  const id = c.req.param('id');
  const b = await c.req.json().catch(() => ({}));

  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (b.status) { sets.push(`status = $${i}`); vals.push(b.status); i++; if (b.status === 'Completed') { sets.push(`completed_at = NOW()`); } }
  if (b.title) { sets.push(`title = $${i}`); vals.push(b.title); i++; }
  if (b.priority) { sets.push(`priority = $${i}`); vals.push(b.priority); i++; }
  if (b.assignedTo !== undefined) { sets.push(`assigned_to = $${i}`); vals.push(b.assignedTo); i++; }
  if (sets.length === 0) return c.json({ message: 'No fields' }, 400);

  sets.push('updated_at = NOW()');
  vals.push(id);
  const r = await query(t, `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  return c.json(r.rows[0] || { message: 'Not found' });
});

tasks.delete('/:id', async (c) => {
  const t = c.get('tenantId');
  await query(t, 'DELETE FROM tasks WHERE id = $1', [c.req.param('id')]);
  return c.json({ message: 'Deleted' });
});

export default tasks;
