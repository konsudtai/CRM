import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enables Row-Level Security (RLS) on all tenant-scoped sales tables and creates
 * policies that restrict access to rows matching the current tenant set via
 * the PostgreSQL session variable `app.current_tenant`.
 *
 * The TenantGuard middleware sets this variable on each request:
 *   SET LOCAL app.current_tenant = '<tenant_uuid>';
 */
export class RlsPolicies1700000000002 implements MigrationInterface {
  name = 'RlsPolicies1700000000002';

  private readonly tenantScopedTables = [
    'pipeline_stages',
    'leads',
    'opportunities',
    'sales_targets',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tenantScopedTables) {
      // Enable RLS on the table
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);

      // Force RLS even for table owners (important for superuser safety)
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);

      // Create policy that restricts SELECT, UPDATE, DELETE
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

    // opportunity_history and lead_scores don't have tenant_id directly,
    // but are scoped through their parent tables via FK.
    await queryRunner.query(`ALTER TABLE opportunity_history ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE opportunity_history FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON opportunity_history
        USING (
          opportunity_id IN (
            SELECT id FROM opportunities
            WHERE tenant_id = current_setting('app.current_tenant')::uuid
          )
        )
    `);

    await queryRunner.query(`ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE lead_scores FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON lead_scores
        USING (
          lead_id IN (
            SELECT id FROM leads
            WHERE tenant_id = current_setting('app.current_tenant')::uuid
          )
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const allTables = [
      ...this.tenantScopedTables,
      'opportunity_history',
      'lead_scores',
    ];

    for (const table of allTables) {
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON ${table}`);
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_insert ON ${table}`);
      await queryRunner.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
    }
  }
}
