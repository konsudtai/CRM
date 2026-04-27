import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateApiKeysTable1700000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        name VARCHAR(255) NOT NULL,
        key_hash VARCHAR(64) NOT NULL UNIQUE,
        key_prefix VARCHAR(8) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        expires_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_api_keys_tenant_id ON api_keys(tenant_id);
      CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

      -- RLS policy for tenant isolation
      ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation_api_keys ON api_keys
        USING (tenant_id = current_setting('app.current_tenant')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP POLICY IF EXISTS tenant_isolation_api_keys ON api_keys;
      DROP TABLE IF EXISTS api_keys;
    `);
  }
}
