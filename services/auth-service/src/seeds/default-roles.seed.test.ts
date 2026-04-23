import { DEFAULT_ROLES, ALL_MODULES, ALL_ACTIONS } from './default-roles.seed';

describe('Default Roles Seed Definitions', () => {
  it('should define exactly 4 default roles', () => {
    expect(DEFAULT_ROLES).toHaveLength(4);
    expect(DEFAULT_ROLES.map((r) => r.name)).toEqual([
      'Admin',
      'Sales Manager',
      'Sales Rep',
      'Viewer',
    ]);
  });

  it('Admin should have full permissions on all modules', () => {
    const admin = DEFAULT_ROLES.find((r) => r.name === 'Admin')!;
    expect(admin.permissions).toHaveLength(ALL_MODULES.length);
    for (const perm of admin.permissions) {
      expect(ALL_MODULES).toContain(perm.module);
      expect(perm.actions).toEqual(ALL_ACTIONS);
    }
  });

  it('Sales Manager should have full permissions on sales-related modules', () => {
    const mgr = DEFAULT_ROLES.find((r) => r.name === 'Sales Manager')!;
    const expectedModules = ['leads', 'opportunities', 'quotations', 'tasks', 'reports'];
    expect(mgr.permissions.map((p) => p.module).sort()).toEqual(expectedModules.sort());
    for (const perm of mgr.permissions) {
      expect(perm.actions).toEqual(ALL_ACTIONS);
    }
  });

  it('Sales Rep should have create/read/update on core modules and read on reports', () => {
    const rep = DEFAULT_ROLES.find((r) => r.name === 'Sales Rep')!;
    const crudModules = rep.permissions.filter((p) =>
      p.actions.includes('create'),
    );
    expect(crudModules.map((p) => p.module).sort()).toEqual(
      ['leads', 'opportunities', 'quotations', 'tasks'].sort(),
    );
    for (const perm of crudModules) {
      expect(perm.actions).toEqual(['create', 'read', 'update']);
    }

    const reportsPerm = rep.permissions.find((p) => p.module === 'reports')!;
    expect(reportsPerm.actions).toEqual(['read']);
  });

  it('Viewer should have read-only on all modules', () => {
    const viewer = DEFAULT_ROLES.find((r) => r.name === 'Viewer')!;
    expect(viewer.permissions).toHaveLength(ALL_MODULES.length);
    for (const perm of viewer.permissions) {
      expect(perm.actions).toEqual(['read']);
    }
  });

  it('ALL_MODULES should contain all 9 expected modules', () => {
    expect(ALL_MODULES).toEqual([
      'accounts',
      'contacts',
      'leads',
      'opportunities',
      'quotations',
      'tasks',
      'reports',
      'settings',
      'users',
    ]);
  });
});
