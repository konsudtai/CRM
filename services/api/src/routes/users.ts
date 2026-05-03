/**
 * User management routes — CRUD, role assignment, password reset.
 * Each user gets their own SNS topic on creation, deleted on user deletion.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import * as bcrypt from 'bcryptjs';
import { query, queryNoRLS } from '../lib/db.js';
import { authMiddleware, type TokenPayload } from '../lib/auth.js';
import {
  createUserTopic,
  deleteUserTopic,
  subscribeEmail,
  subscribeSMS,
  publishToUser,
  getSubscriptions,
  unsubscribe,
} from '../lib/sns.js';

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
    u.sns_topic_arn,
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

  // Insert user first to get the ID
  const result = await query(tenantId,
    `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone, force_password_change)
     VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id, email, first_name, last_name, is_active`,
    [tenantId, email, hash, firstName, lastName, phone || null]
  );

  const userId = result.rows[0].id;

  // Assign role if provided
  if (roleId) {
    await query(tenantId,
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, roleId]
    );
  }

  // Create SNS topic for this user (non-blocking — don't fail user creation if SNS fails)
  let topicArn: string | null = null;
  try {
    topicArn = await createUserTopic(tenantId, userId);

    // Store topic ARN in DB
    await query(tenantId,
      'UPDATE users SET sns_topic_arn = $1 WHERE id = $2',
      [topicArn, userId]
    );

    // Subscribe email to topic
    await subscribeEmail(topicArn, email);

    // Subscribe phone (SMS) if provided
    if (phone) {
      try {
        await subscribeSMS(topicArn, phone);
      } catch (smsErr: any) {
        console.warn(`SMS subscription failed for ${phone}: ${smsErr.message}`);
      }
    }

    // Send welcome notification
    const welcomeMsg = `สวัสดีครับ ${firstName} ${lastName}\n\nบัญชีของคุณใน SalesFAST 7 ถูกสร้างแล้ว\nEmail: ${email}\n\nกรุณาเปลี่ยนรหัสผ่านเมื่อ login ครั้งแรก`;
    const welcomeEmail = `
สวัสดีครับ ${firstName} ${lastName},

บัญชีของคุณใน SalesFAST 7 CRM ถูกสร้างแล้ว

รายละเอียดบัญชี:
- Email: ${email}
- ชื่อ: ${firstName} ${lastName}

กรุณา login และเปลี่ยนรหัสผ่านทันที

ขอบคุณครับ
ทีม SalesFAST 7
    `.trim();

    await publishToUser(topicArn, 'ยินดีต้อนรับสู่ SalesFAST 7', welcomeMsg, welcomeEmail);

  } catch (snsErr: any) {
    // Log but don't fail — user is already created
    console.error(`SNS setup failed for user ${userId}: ${snsErr.message}`);
  }

  return c.json({
    ...result.rows[0],
    snsTopicArn: topicArn,
    message: topicArn
      ? 'User created. Welcome email sent.'
      : 'User created. (Email notification unavailable)',
  }, 201);
});

// ── DELETE /users/:id ──
users.delete('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  // Get SNS topic ARN before deleting
  const userResult = await query(tenantId,
    'SELECT sns_topic_arn, email FROM users WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );

  if (userResult.rows.length === 0) return c.json({ message: 'User not found' }, 404);

  const { sns_topic_arn: topicArn } = userResult.rows[0];

  // Delete SNS topic if exists
  if (topicArn) {
    try {
      await deleteUserTopic(topicArn);
    } catch (snsErr: any) {
      console.error(`SNS topic deletion failed for ${topicArn}: ${snsErr.message}`);
    }
  }

  // Deactivate user (soft delete — keep for audit trail)
  await query(tenantId,
    'UPDATE users SET is_active = false, sns_topic_arn = NULL WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );

  return c.json({ message: 'User deleted and SNS topic removed' });
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

  // Send reset notification via SNS
  const userResult = await query(tenantId,
    'SELECT sns_topic_arn, first_name, last_name FROM users WHERE id = $1',
    [id]
  );
  if (userResult.rows[0]?.sns_topic_arn) {
    try {
      const { sns_topic_arn: topicArn, first_name, last_name } = userResult.rows[0];
      await publishToUser(
        topicArn,
        'รหัสผ่านถูก Reset แล้ว — SalesFAST 7',
        `สวัสดีครับ ${first_name} ${last_name}\n\nรหัสผ่านของคุณถูก reset แล้ว กรุณา login และเปลี่ยนรหัสผ่านทันที`,
        `สวัสดีครับ ${first_name} ${last_name},\n\nรหัสผ่านของคุณใน SalesFAST 7 ถูก reset โดย Admin\nกรุณา login และเปลี่ยนรหัสผ่านทันที\n\nถ้าคุณไม่ได้ขอ reset กรุณาติดต่อ Admin ทันที`
      );
    } catch (snsErr: any) {
      console.error(`SNS notification failed: ${snsErr.message}`);
    }
  }

  return c.json({ message: 'Password reset. Notification sent.' });
});

// ── POST /users/:id/notify ── (send custom notification to user)
users.post('/:id/notify', async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  if (!body.subject || !body.message) return c.json({ message: 'subject and message required' }, 400);

  const userResult = await query(tenantId,
    'SELECT sns_topic_arn FROM users WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );

  if (!userResult.rows[0]?.sns_topic_arn) {
    return c.json({ message: 'User has no SNS topic' }, 404);
  }

  await publishToUser(userResult.rows[0].sns_topic_arn, body.subject, body.message, body.emailMessage);
  return c.json({ message: 'Notification sent' });
});

// ── GET /users/:id/subscriptions ── (list SNS subscriptions)
users.get('/:id/subscriptions', async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const userResult = await query(tenantId,
    'SELECT sns_topic_arn FROM users WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );

  if (!userResult.rows[0]?.sns_topic_arn) {
    return c.json([]);
  }

  const subs = await getSubscriptions(userResult.rows[0].sns_topic_arn);
  return c.json(subs.map(s => ({
    protocol: s.Protocol,
    endpoint: s.Endpoint,
    status: s.SubscriptionArn === 'PendingConfirmation' ? 'pending' : 'confirmed',
    arn: s.SubscriptionArn,
  })));
});

// ── PATCH /users/:id/profile ──
users.patch('/:id/profile', async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;

  if (body.firstName !== undefined) { sets.push(`first_name = $${i}`); vals.push(body.firstName); i++; }
  if (body.lastName !== undefined) { sets.push(`last_name = $${i}`); vals.push(body.lastName); i++; }
  if (body.phone !== undefined) { sets.push(`phone = $${i}`); vals.push(body.phone); i++; }
  if (body.lineId !== undefined) { sets.push(`line_id = $${i}`); vals.push(body.lineId); i++; }
  if (body.preferredLanguage !== undefined) { sets.push(`preferred_language = $${i}`); vals.push(body.preferredLanguage); i++; }

  if (sets.length === 0) return c.json({ message: 'No fields to update' }, 400);
  vals.push(id);

  await query(tenantId, `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} AND tenant_id = '${tenantId}'`, vals);
  return c.json({ message: 'Profile updated' });
});

export default users;
