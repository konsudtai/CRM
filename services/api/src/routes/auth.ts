/**
 * Auth routes — login, logout, refresh, me, change password.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { queryNoRLS, query } from '../lib/db.js';
import { signToken, authMiddleware, type TokenPayload } from '../lib/auth.js';

const auth = new Hono();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// ── POST /auth/login ──
auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return c.json({ message: 'Invalid email or password' }, 400);

  const { email, password } = parsed.data;

  // Find user (no RLS — pre-auth)
  const result = await queryNoRLS(
    `SELECT u.id, u.tenant_id, u.email, u.password_hash, u.first_name, u.last_name,
            u.is_active, u.force_password_change, u.mfa_enabled, u.failed_login_count, u.locked_until
     FROM users u WHERE u.email = $1`,
    [email]
  );

  if (result.rows.length === 0) {
    return c.json({ message: 'Invalid email or password' }, 401);
  }

  const user = result.rows[0];

  if (!user.is_active) {
    return c.json({ message: 'Account is inactive' }, 401);
  }

  // Check lockout
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return c.json({ message: 'Account locked. Try again later.' }, 403);
  }

  // Validate password
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const newCount = (user.failed_login_count || 0) + 1;
    const lockUntil = newCount >= 5
      ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
      : null;
    await queryNoRLS(
      'UPDATE users SET failed_login_count = $1, locked_until = $2 WHERE id = $3',
      [newCount, lockUntil, user.id]
    );
    return c.json({ message: 'Invalid email or password' }, 401);
  }

  // Clear lockout on success
  await queryNoRLS(
    `UPDATE users SET failed_login_count = 0, locked_until = NULL,
     last_login_at = NOW(), last_login_ip = $1 WHERE id = $2`,
    [c.req.header('x-forwarded-for') || 'unknown', user.id]
  );

  // Get user roles
  const rolesResult = await queryNoRLS(
    `SELECT r.name FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1`,
    [user.id]
  );
  const roles = rolesResult.rows.map((r: any) => r.name);

  // Issue tokens
  const payload: TokenPayload = {
    sub: user.id,
    tenantId: user.tenant_id,
    email: user.email,
    roles,
  };

  const accessToken = await signToken(payload, '15m');
  const refreshToken = uuidv4();

  return c.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      roles,
      forcePasswordChange: user.force_password_change,
    },
  });
});

// ── GET /auth/me ──
auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user') as TokenPayload;
  const result = await query(user.tenantId,
    `SELECT id, tenant_id, email, first_name, last_name, phone, line_id,
            mfa_enabled, preferred_language, preferred_calendar, is_active, last_login_at
     FROM users WHERE id = $1`,
    [user.sub]
  );

  if (result.rows.length === 0) return c.json({ message: 'User not found' }, 404);

  // Get permissions
  const permsResult = await query(user.tenantId,
    `SELECT rp.module, rp.action FROM role_permissions rp
     JOIN user_roles ur ON ur.role_id = rp.role_id
     WHERE ur.user_id = $1`,
    [user.sub]
  );

  const permissions: Record<string, string[]> = {};
  for (const row of permsResult.rows) {
    if (!permissions[row.module]) permissions[row.module] = [];
    permissions[row.module].push(row.action);
  }

  return c.json({ ...result.rows[0], roles: user.roles, permissions });
});

// ── POST /auth/change-password ──
auth.post('/change-password', authMiddleware, async (c) => {
  const user = c.get('user') as TokenPayload;
  const body = await c.req.json().catch(() => ({}));
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) return c.json({ message: 'Invalid input' }, 400);

  const { currentPassword, newPassword } = parsed.data;

  const result = await query(user.tenantId,
    'SELECT password_hash FROM users WHERE id = $1', [user.sub]
  );
  if (result.rows.length === 0) return c.json({ message: 'User not found' }, 404);

  const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
  if (!valid) return c.json({ message: 'Current password is incorrect' }, 401);

  const newHash = await bcrypt.hash(newPassword, 12);
  await query(user.tenantId,
    'UPDATE users SET password_hash = $1, force_password_change = false WHERE id = $2',
    [newHash, user.sub]
  );

  return c.json({ message: 'Password changed successfully' });
});

export default auth;
