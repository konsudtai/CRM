import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the immutable audit_logs table with RLS enabled.
 * This table is append-only — no UPDATE or DELETE operations are permitted.
 */
export class CreateAuditLog1700000000003 implements MigrationInterface {
  name = 'CreateAuditLog1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        user_id UUID NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id UUID NOT NULL,
        action VARCHAR(20) NOT NULL,
        old_values JSONB,
        new_values JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_audit_logs_tenant_entity ON audit_logs(tenant_id, entity_type, entity_id)`);
    await queryRunner.query(`CREATE INDEX idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at)`);

    await queryRunner.query(`ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY`);

    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON audit_logs
        USING (tenant_id = current_setting('app.current_tenant')::uuid)
    `);

    await queryRunner.query(`
      CREATE POLICY tenant_isolation_insert ON audit_logs
        FOR INSERT
        WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid)
    `);

    /* Revoke UPDATE and DELETE to enforce immutability at the DB level */
    await queryRunner.query(`REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON audit_logs`);
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_insert ON audit_logs`);
    await queryRunner.query(`ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`);
  }
}
