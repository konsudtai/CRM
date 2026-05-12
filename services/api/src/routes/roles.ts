/**
 * Roles & Permissions management routes.
 * CRUD for roles + permission matrix updates.
 */
import { Hono } from 'hono';
import { query } from '../lib/db.js';
import { authMiddleware, requireRole, type TokenPayload } from '../lib/auth.js';

const roles = new Hono();
roles.use('*', authMiddleware);

// ── GET /roles ── List all roles with permissions
roles.get('/', async (c) => {
  const tenantId = c.get('tenantId');

  const rolesResult = await query(tenantId,
    `SELECT id, name, is_default, created_at FROM roles WHERE tenant_id = $1 ORDER BY created_at`,
    [tenantId]
  );

  // Get permissions for each role
  const rolesWithPerms = [];
  for (const role of rolesResult.rows) {
    const permsResult = await query(tenantId,
      `SELECT module, action FROM role_permissions WHERE role_id = $1`,
      [role.id]
    );
    rolesWithPerms.push({
      id: role.id,
      name: role.name,
      isDefault: role.is_default,
      createdAt: role.created_at,
      permissions: permsResult.rows,
    });
  }

  return c.json(rolesWithPerms);
});

// ── GET /roles/:id ── Single role with permissions
roles.get('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const roleResult = await query(tenantId,
    `SELECT id, name, is_default, created_at FROM roles WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );

  if (roleResult.rows.length === 0) return c.json({ message: 'Role not found' }, 404);

  const permsResult = await query(tenantId,
    `SELECT module, action FROM role_permissions WHERE role_id = $1`,
    [id]
  );

  return c.json({
    ...roleResult.rows[0],
    permissions: permsResult.rows,
  });
});

// ── POST /roles ── Create a new role (Admin only)
roles.post('/', requireRole('Admin'), async (c) => {
  const tenantId = c.get('tenantId');
  const body = await c.req.json().catch(() => ({})) as any;

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return c.json({ message: 'Role name is required' }, 400);
  }

  const name = body.name.trim();

  // Check duplicate
  const existing = await query(tenantId,
    `SELECT id FROM roles WHERE name = $1 AND tenant_id = $2`,
    [name, tenantId]
  );
  if (existing.rows.length > 0) {
    return c.json({ message: 'Role already exists' }, 409);
  }

  const result = await query(tenantId,
    `INSERT INTO roles (tenant_id, name, is_default) VALUES ($1, $2, $3) RETURNING id, name, is_default, created_at`,
    [tenantId, name, body.isDefault || false]
  );

  // Insert permissions if provided
  if (body.permissions && Array.isArray(body.permissions)) {
    for (const perm of body.permissions) {
      if (perm.module && perm.action) {
        await query(tenantId,
          `INSERT INTO role_permissions (role_id, module, action) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [result.rows[0].id, perm.module, perm.action]
        );
      }
    }
  }

  return c.json(result.rows[0], 201);
});

// ── PATCH /roles/:id ── Update role name (Admin only)
roles.patch('/:id', requireRole('Admin'), async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({})) as any;

  if (!body.name || typeof body.name !== 'string') {
    return c.json({ message: 'Role name is required' }, 400);
  }

  const result = await query(tenantId,
    `UPDATE roles SET name = $1 WHERE id = $2 AND tenant_id = $3 RETURNING id, name, is_default`,
    [body.name.trim(), id, tenantId]
  );

  if (result.rows.length === 0) return c.json({ message: 'Role not found' }, 404);
  return c.json({ message: 'Role updated', role: result.rows[0] });
});

// ── DELETE /roles/:id ── Delete role (Admin only)
roles.delete('/:id', requireRole('Admin'), async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  // Check if role is in use
  const usersWithRole = await query(tenantId,
    `SELECT count(*) as c FROM user_roles WHERE role_id = $1`,
    [id]
  );

  if (parseInt(usersWithRole.rows[0].c) > 0) {
    return c.json({
      message: 'Cannot delete role that is assigned to users. Remove users from this role first.',
      usersCount: parseInt(usersWithRole.rows[0].c),
    }, 400);
  }

  // Delete permissions first (cascade should handle, but explicit)
  await query(tenantId, `DELETE FROM role_permissions WHERE role_id = $1`, [id]);

  const result = await query(tenantId,
    `DELETE FROM roles WHERE id = $1 AND tenant_id = $2 RETURNING id, name`,
    [id, tenantId]
  );

  if (result.rows.length === 0) return c.json({ message: 'Role not found' }, 404);
  return c.json({ message: 'Role deleted', role: result.rows[0] });
});

// ── PUT /roles/permissions/bulk ── Update permissions for ALL roles at once (Admin only)
// Body: { "Admin": { "Dashboard": "CRUD", "Accounts": "CRUD", ... }, "Viewer": { "Dashboard": "R", ... } }
roles.put('/permissions/bulk', requireRole('Admin'), async (c) => {
  const tenantId = c.get('tenantId');
  const body = await c.req.json().catch(() => ({})) as Record<string, Record<string, string>>;

  if (!body || typeof body !== 'object') {
    return c.json({ message: 'Invalid body format' }, 400);
  }

  let totalUpdated = 0;

  for (const [roleName, modules] of Object.entries(body)) {
    // Find role ID
    const roleResult = await query(tenantId,
      `SELECT id FROM roles WHERE name = $1 AND tenant_id = $2`,
      [roleName, tenantId]
    );
    if (roleResult.rows.length === 0) continue;

    const roleId = roleResult.rows[0].id;

    // Delete existing permissions for this role
    await query(tenantId, `DELETE FROM role_permissions WHERE role_id = $1`, [roleId]);

    // Insert new permissions
    for (const [module, actions] of Object.entries(modules)) {
      const actionMap: Record<string, string> = { C: 'create', R: 'read', U: 'update', D: 'delete' };
      for (const char of actions) {
        const action = actionMap[char];
        if (action) {
          await query(tenantId,
            `INSERT INTO role_permissions (role_id, module, action) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [roleId, module.toLowerCase(), action]
          );
          totalUpdated++;
        }
      }
    }
  }

  return c.json({ message: 'Bulk permissions updated', totalPermissions: totalUpdated });
});

// ── PUT /roles/:id/permissions ── Replace all permissions for a single role (Admin only)
roles.put('/:id/permissions', requireRole('Admin'), async (c) => {
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({})) as any;

  // Verify role exists
  const roleResult = await query(tenantId,
    `SELECT id FROM roles WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );
  if (roleResult.rows.length === 0) return c.json({ message: 'Role not found' }, 404);

  // body.permissions should be array of { module, action }
  if (!body.permissions || !Array.isArray(body.permissions)) {
    return c.json({ message: 'permissions array is required' }, 400);
  }

  // Delete existing permissions
  await query(tenantId, `DELETE FROM role_permissions WHERE role_id = $1`, [id]);

  // Insert new permissions
  for (const perm of body.permissions) {
    if (perm.module && perm.action) {
      await query(tenantId,
        `INSERT INTO role_permissions (role_id, module, action) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [id, perm.module.toLowerCase(), perm.action.toLowerCase()]
      );
    }
  }

  return c.json({ message: 'Permissions updated', roleId: id, count: body.permissions.length });
});

export default roles;
