import { Hono } from 'hono';
import { query } from '../lib/db.js';
import { authMiddleware } from '../lib/auth.js';

const activities = new Hono();
activities.use('*', authMiddleware);

activities.get('/', async (c) => {
  const t = c.get('tenantId');
  const entityType = c.req.query('entityType');
  const entityId = c.req.query('entityId');
  const limit = parseInt(c.req.query('limit') || '20');

  let where = 'tenant_id = $1';
  const params: any[] = [t];
  if (entityType) { where += ` AND entity_type = $2`; params.push(entityType); }
  if (entityId) { where += ` AND entity_id = $${params.length + 1}`; params.push(entityId); }
  params.push(limit);

  const r = await query(t, `SELECT * FROM activities WHERE ${where} ORDER BY timestamp DESC LIMIT $${params.length}`, params);
  return c.json(r.rows);
});

activities.post('/', async (c) => {
  const t = c.get('tenantId');
  const b = await c.req.json().catch(() => ({}));
  const r = await query(t,
    `INSERT INTO activities (tenant_id, entity_type, entity_id, summary, user_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [t, b.entityType, b.entityId, b.summary, b.userId||c.get('userId'), JSON.stringify(b.metadata||{})]);
  return c.json(r.rows[0], 201);
});

export default activities;
