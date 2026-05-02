import { Hono } from 'hono';
import { query } from '../lib/db.js';
import { authMiddleware } from '../lib/auth.js';

const notifications = new Hono();
notifications.use('*', authMiddleware);

notifications.get('/', async (c) => {
  const t = c.get('tenantId');
  const userId = c.get('userId');
  const limit = parseInt(c.req.query('limit') || '20');
  const r = await query(t,
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]);
  return c.json(r.rows);
});

notifications.post('/', async (c) => {
  const t = c.get('tenantId');
  const b = await c.req.json().catch(() => ({}));
  const r = await query(t,
    `INSERT INTO notifications (tenant_id, user_id, channel, type, title, body, metadata, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`,
    [t, b.userId, b.channel||'in_app', b.type||'general', b.title||'', b.body||'', JSON.stringify(b.metadata||{})]);
  return c.json(r.rows[0], 201);
});

export default notifications;
