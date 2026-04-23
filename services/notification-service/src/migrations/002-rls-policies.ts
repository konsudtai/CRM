import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enables Row-Level Security (RLS) on all tenant-scoped notification tables
 * and creates policies that restrict access to rows matching the current tenant
 * set via the PostgreSQL session variable `app.current_tenant`.
 *
 * The TenantGuard middleware sets this variable on each request:
 *   SET LOCAL app.current_tenant = '<tenant_uuid>';
 */
export class RlsPolicies1700000000002 implements MigrationInterface {
  name = 'RlsPolicies1700000000002';

  private readonly tenantScopedTables = [
    'notifications',
    'webhook_configs',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tenantScopedTables) {
      // Enable RLS on the table
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);

      // Force RLS even for table owners
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);

      // Create policy that restricts SELECT, UPDATE, DELETE
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

    // webhook_deliveries doesn't have tenant_id directly, but is scoped
    // through the webhook_configs table via webhook_id FK.
    await queryRunner.query(`ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE webhook_deliveries FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON webhook_deliveries
        USING (
          webhook_id IN (
            SELECT id FROM webhook_configs
            WHERE tenant_id = current_setting('app.current_tenant')::uuid
          )
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const allTables = [...this.tenantScopedTables, 'webhook_deliveries'];

    for (const table of allTables) {
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON ${table}`);
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_insert ON ${table}`);
      await queryRunner.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
    }
  }
}
