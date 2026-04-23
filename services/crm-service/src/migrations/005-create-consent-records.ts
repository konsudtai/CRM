import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the immutable consent_records table with RLS enabled.
 * This table is append-only — no UPDATE or DELETE operations are permitted.
 */
export class CreateConsentRecords1700000000005 implements MigrationInterface {
  name = 'CreateConsentRecords1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE consent_records (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        contact_id UUID NOT NULL,
        purpose VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL,
        granted_at DATE,
        expires_at DATE,
        withdrawn_at DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_consent_records_tenant ON consent_records(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_consent_records_tenant_contact ON consent_records(tenant_id, contact_id)`);
    await queryRunner.query(`CREATE INDEX idx_consent_records_tenant_contact_purpose ON consent_records(tenant_id, contact_id, purpose)`);

    await queryRunner.query(`ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE consent_records FORCE ROW LEVEL SECURITY`);

    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON consent_records
        USING (tenant_id = current_setting('app.current_tenant')::uuid)
    `);

    await queryRunner.query(`
      CREATE POLICY tenant_isolation_insert ON consent_records
        FOR INSERT
        WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid)
    `);

    /* Revoke UPDATE and DELETE to enforce immutability at the DB level */
    await queryRunner.query(`REVOKE UPDATE, DELETE ON consent_records FROM PUBLIC`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON consent_records`);
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_insert ON consent_records`);
    await queryRunner.query(`ALTER TABLE consent_records DISABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP TABLE IF EXISTS consent_records`);
  }
}
