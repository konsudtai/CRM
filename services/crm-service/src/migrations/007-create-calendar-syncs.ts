import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCalendarSyncs1719000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS calendar_syncs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        user_id UUID NOT NULL,
        provider VARCHAR(30) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'disconnected',
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TIMESTAMPTZ,
        last_sync_at TIMESTAMPTZ,
        last_error VARCHAR(255),
        consecutive_failures INT NOT NULL DEFAULT 0,
        calendar_id VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_calendar_syncs_tenant ON calendar_syncs (tenant_id);
      CREATE INDEX idx_calendar_syncs_tenant_user ON calendar_syncs (tenant_id, user_id);
      CREATE UNIQUE INDEX idx_calendar_syncs_tenant_user_provider ON calendar_syncs (tenant_id, user_id, provider);

      -- RLS policies
      ALTER TABLE calendar_syncs ENABLE ROW LEVEL SECURITY;

      CREATE POLICY calendar_syncs_tenant_isolation ON calendar_syncs
        USING (tenant_id = current_setting('app.current_tenant')::uuid);

      CREATE POLICY calendar_syncs_tenant_isolation_insert ON calendar_syncs
        FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP POLICY IF EXISTS calendar_syncs_tenant_isolation_insert ON calendar_syncs;
      DROP POLICY IF EXISTS calendar_syncs_tenant_isolation ON calendar_syncs;
      DROP TABLE IF EXISTS calendar_syncs;
    `);
  }
}
