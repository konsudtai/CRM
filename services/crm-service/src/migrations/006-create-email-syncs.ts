import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailSyncs1719000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS email_syncs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        user_id UUID NOT NULL,
        provider VARCHAR(20) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'disconnected',
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TIMESTAMPTZ,
        last_sync_at TIMESTAMPTZ,
        last_error VARCHAR(255),
        consecutive_failures INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_email_syncs_tenant ON email_syncs (tenant_id);
      CREATE INDEX idx_email_syncs_tenant_user ON email_syncs (tenant_id, user_id);
      CREATE UNIQUE INDEX idx_email_syncs_tenant_user_provider ON email_syncs (tenant_id, user_id, provider);

      -- RLS policy
      ALTER TABLE email_syncs ENABLE ROW LEVEL SECURITY;

      CREATE POLICY email_syncs_tenant_isolation ON email_syncs
        USING (tenant_id = current_setting('app.current_tenant')::uuid);

      CREATE POLICY email_syncs_tenant_isolation_insert ON email_syncs
        FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP POLICY IF EXISTS email_syncs_tenant_isolation_insert ON email_syncs;
      DROP POLICY IF EXISTS email_syncs_tenant_isolation ON email_syncs;
      DROP TABLE IF EXISTS email_syncs;
    `);
  }
}
