import { DataSource } from 'typeorm';
import { Role } from '../entities/role.entity';
import { RolePermission } from '../entities/role-permission.entity';

const ALL_MODULES = [
  'accounts',
  'contacts',
  'leads',
  'opportunities',
  'quotations',
  'tasks',
  'reports',
  'settings',
  'users',
];

const ALL_ACTIONS: ('create' | 'read' | 'update' | 'delete')[] = [
  'create',
  'read',
  'update',
  'delete',
];

const SALES_MODULES = [
  'leads',
  'opportunities',
  'quotations',
  'tasks',
  'reports',
];

interface DefaultRoleDefinition {
  name: string;
  permissions: { module: string; actions: ('create' | 'read' | 'update' | 'delete')[] }[];
}

const DEFAULT_ROLES: DefaultRoleDefinition[] = [
  {
    name: 'Admin',
    permissions: ALL_MODULES.map((m) => ({ module: m, actions: ALL_ACTIONS })),
  },
  {
    name: 'Sales Manager',
    permissions: SALES_MODULES.map((m) => ({ module: m, actions: ALL_ACTIONS })),
  },
  {
    name: 'Sales Rep',
    permissions: [
      ...['leads', 'opportunities', 'quotations', 'tasks'].map((m) => ({
        module: m,
        actions: ['create', 'read', 'update'] as ('create' | 'read' | 'update' | 'delete')[],
      })),
      { module: 'reports', actions: ['read'] as ('create' | 'read' | 'update' | 'delete')[] },
    ],
  },
  {
    name: 'Viewer',
    permissions: ALL_MODULES.map((m) => ({
      module: m,
      actions: ['read'] as ('create' | 'read' | 'update' | 'delete')[],
    })),
  },
];

/**
 * Seeds default roles for a given tenant.
 * Idempotent — skips roles that already exist.
 */
export async function seedDefaultRoles(
  dataSource: DataSource,
  tenantId: string,
): Promise<Role[]> {
  const roleRepo = dataSource.getRepository(Role);
  const rpRepo = dataSource.getRepository(RolePermission);

  const seeded: Role[] = [];

  for (const def of DEFAULT_ROLES) {
    // Check if role already exists for this tenant
    let role = await roleRepo.findOne({
      where: { tenantId, name: def.name },
    });

    if (!role) {
      role = roleRepo.create({
        tenantId,
        name: def.name,
        isDefault: true,
      });
      role = await roleRepo.save(role);

      // Create permission entries
      const permEntities: RolePermission[] = [];
      for (const perm of def.permissions) {
        for (const action of perm.actions) {
          permEntities.push(
            rpRepo.create({
              roleId: role.id,
              module: perm.module,
              action,
            }),
          );
        }
      }

      if (permEntities.length > 0) {
        await rpRepo.save(permEntities);
      }
    }

    seeded.push(role);
  }

  return seeded;
}

/** Exported for testing and reference */
export { DEFAULT_ROLES, ALL_MODULES, ALL_ACTIONS };
