import { Hono } from 'hono';
import { query } from '../lib/db.js';
import { authMiddleware } from '../lib/auth.js';

const products = new Hono();
products.use('*', authMiddleware);

products.get('/', async (c) => {
  const t = c.get('tenantId');
  const search = c.req.query('search');
  const limit = parseInt(c.req.query('limit') || '50');
  let where = 'tenant_id = $1';
  const params: any[] = [t];
  let idx = 2;
  if (search) { where += ` AND (name ILIKE $${idx} OR sku ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
  params.push(limit);
  const r = await query(t, `SELECT * FROM products WHERE ${where} ORDER BY name LIMIT $${idx}`, params);
  return c.json(r.rows);
});

products.get('/:id', async (c) => {
  const t = c.get('tenantId');
  const r = await query(t, 'SELECT * FROM products WHERE id = $1', [c.req.param('id')]);
  if (r.rows.length === 0) return c.json({ message: 'Not found' }, 404);
  return c.json(r.rows[0]);
});

products.post('/', async (c) => {
  const t = c.get('tenantId');
  const b = await c.req.json().catch(() => ({}));
  if (!b.name || !b.sku) return c.json({ message: 'name and sku required' }, 400);
  const r = await query(t,
    `INSERT INTO products (tenant_id, name, sku, description, unit_price, unit_of_measure, wht_rate, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [t, b.name, b.sku, b.description||null, b.unitPrice||0, b.unitOfMeasure||'ชุด', b.whtRate||0, b.isActive??true]
  );
  return c.json(r.rows[0], 201);
});

products.patch('/:id', async (c) => {
  const t = c.get('tenantId');
  const b = await c.req.json().catch(() => ({}));
  const id = c.req.param('id');

  const mapping: Record<string, string> = {
    name: 'name', sku: 'sku', description: 'description',
    unitPrice: 'unit_price', unitOfMeasure: 'unit_of_measure',
    whtRate: 'wht_rate', isActive: 'is_active',
  };

  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(b)) {
    const col = mapping[k];
    if (col) { sets.push(`${col} = $${i}`); vals.push(v); i++; }
  }
  if (!sets.length) return c.json({ message: 'No fields' }, 400);
  vals.push(id);
  const r = await query(t, `UPDATE products SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  return c.json(r.rows[0] || { message: 'Not found' });
});

products.delete('/:id', async (c) => {
  const t = c.get('tenantId');
  await query(t, 'DELETE FROM products WHERE id = $1', [c.req.param('id')]);
  return c.json({ message: 'Deleted' });
});

export default products;
