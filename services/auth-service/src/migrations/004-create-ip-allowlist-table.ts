import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIpAllowlistTable1700000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ip_allowlist_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        address VARCHAR(45) NOT NULL,
        description VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_ip_allowlist_tenant ON ip_allowlist_entries(tenant_id);
    `);

    // RLS policy for tenant isolation
    await queryRunner.query(`
      ALTER TABLE ip_allowlist_entries ENABLE ROW LEVEL SECURITY;
    `);

    await queryRunner.query(`
      CREATE POLICY tenant_isolation_ip_allowlist ON ip_allowlist_entries
        USING (tenant_id = current_setting('app.current_tenant')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_ip_allowlist ON ip_allowlist_entries;`);
    await queryRunner.query(`DROP TABLE IF EXISTS ip_allowlist_entries;`);
  }
}
