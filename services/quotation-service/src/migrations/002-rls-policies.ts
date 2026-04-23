import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enables Row-Level Security (RLS) on all tenant-scoped quotation tables
 * and creates policies that restrict access to rows matching the current
 * tenant set via the PostgreSQL session variable `app.current_tenant`.
 *
 * The TenantGuard middleware sets this variable on each request:
 *   SET LOCAL app.current_tenant = '<tenant_uuid>';
 */
export class RlsPolicies1700000000002 implements MigrationInterface {
  name = 'QuotationRlsPolicies1700000000002';

  private readonly tenantScopedTables = [
    'products',
    'quotations',
    'quotation_sequences',
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

    // quotation_line_items doesn't have tenant_id directly, but is scoped
    // through the quotations table via quotation_id FK.
    await queryRunner.query(`ALTER TABLE quotation_line_items ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE quotation_line_items FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON quotation_line_items
        USING (
          quotation_id IN (
            SELECT id FROM quotations
            WHERE tenant_id = current_setting('app.current_tenant')::uuid
          )
        )
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_insert ON quotation_line_items
        FOR INSERT
        WITH CHECK (
          quotation_id IN (
            SELECT id FROM quotations
            WHERE tenant_id = current_setting('app.current_tenant')::uuid
          )
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const allTables = [...this.tenantScopedTables, 'quotation_line_items'];

    for (const table of allTables) {
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON ${table}`);
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_insert ON ${table}`);
      await queryRunner.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
    }
  }
}
