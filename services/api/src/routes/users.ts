/**
 * User management routes — CRUD, role assignment, password reset.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import * as bcrypt from 'bcryptjs';
import { query } from '../lib/db.js';
import { authMiddleware, type TokenPayload } from '../lib/auth.js';

const users = new Hono();
users.use('*', authMiddleware);

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  roleId: z.string().uuid().optional(),
});

// ── GET /users ──
users.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  const search = c.req.query('search') || '';
  const limit = parseInt(c.req.query('limit') || '50');

  let sql = `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active, u.last_login_at,
    (SELECT array_agg(r.name) FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = u.id) as roles
    FROM users u WHERE u.tenant_id = $1`;
  const params: any[] = [tenantId];

  if (search) {
    sql += ` AND (u.first_name ILIKE $2 OR u.last_name ILIKE $2 OR u.email ILIKE $2)`;
    params.push(`%${search}%`);
  }
  sql += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await query(tenantId, sql, params);
  return c.json(result.rows);
});

// ── POST /users ──
users.post('/', async (c) => {
  const tenantId = c.get('tenantId');
  const body = await c.req.json().catch(() => ({}));
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return c.json({ message: 'Invalid input', errors: parsed.error.issues }, 400);

  const { email, password, firstName, lastName, phone, roleId } = parsed.data;

  // Check duplicate
  const existing = await query(tenantId, 'SELECT id FROM users WHERE email = $1 AND tenant_id = $2', [email, tenantId]);
  if (existing.rows.length > 0) return c.json({ message: 'Email already exists' }, 409);

  const hash = await bcrypt.hash(password, 12);
  const result = await query(tenantId,
    `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone, force_password_change)
     VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id, email, first_name, last_name, is_active`,
    [tenantId, email, hash, firstName, lastName, phone || null]
  );

  // Assign role if provided
  if (roleId) {
    await query(tenantId,
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [result.rows[0].id, roleId]
    );
  }

  return c.json(result.rows[0], 201);
});

// ── PATCH /users/:id/status ──
users.patch('/:id/status', async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  await query(tenantId, 'UPDATE users SET is_active = $1 WHERE id = $2 AND tenant_id = $3',
    [body.isActive ?? true, id, tenantId]);
  return c.json({ message: 'Updated' });
});

// ── POST /users/:id/reset-password ──
users.post('/:id/reset-password', async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  if (!body.password || body.password.length < 8) return c.json({ message: 'Password min 8 chars' }, 400);

  const hash = await bcrypt.hash(body.password, 12);
  await query(tenantId, 'UPDATE users SET password_hash = $1, force_password_change = true WHERE id = $2 AND tenant_id = $3',
    [hash, id, tenantId]);
  return c.json({ message: 'Password reset' });
});

export default users;
