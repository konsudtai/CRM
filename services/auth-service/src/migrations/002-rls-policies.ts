import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enables Row-Level Security (RLS) on all tenant-scoped tables and creates
 * policies that restrict access to rows matching the current tenant set via
 * the PostgreSQL session variable `app.current_tenant`.
 *
 * The TenantGuard middleware sets this variable on each request:
 *   SET LOCAL app.current_tenant = '<tenant_uuid>';
 */
export class RlsPolicies1700000000002 implements MigrationInterface {
  name = 'RlsPolicies1700000000002';

  private readonly tenantScopedTables = [
    'users',
    'roles',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tenantScopedTables) {
      // Enable RLS on the table
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);

      // Force RLS even for table owners (important for superuser safety)
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);

      // Create policy that restricts SELECT, INSERT, UPDATE, DELETE
      // to rows matching the current tenant
      await queryRunner.query(`
        CREATE POLICY tenant_isolation ON ${table}
          USING (tenant_id = current_setting('app.current_tenant')::uuid)
      `);

      // Allow INSERT only with matching tenant_id
      await queryRunner.query(`
        CREATE POLICY tenant_isolation_insert ON ${table}
          FOR INSERT
          WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid)
      `);
    }

    // role_permissions doesn't have tenant_id directly, but is scoped
    // through the roles table via role_id FK. We create a policy that
    // joins to roles to enforce tenant isolation.
    await queryRunner.query(`ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON role_permissions
        USING (
          role_id IN (
            SELECT id FROM roles
            WHERE tenant_id = current_setting('app.current_tenant')::uuid
          )
        )
    `);

    // user_roles is scoped through both users and roles tables
    await queryRunner.query(`ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE user_roles FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON user_roles
        USING (
          user_id IN (
            SELECT id FROM users
            WHERE tenant_id = current_setting('app.current_tenant')::uuid
          )
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const allTables = [...this.tenantScopedTables, 'role_permissions', 'user_roles'];

    for (const table of allTables) {
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON ${table}`);
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_insert ON ${table}`);
      await queryRunner.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
    }
  }
}
