import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationTables1700000000001 implements MigrationInterface {
  name = 'CreateNotificationTables1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Notifications table
    await queryRunner.query(`
      CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        user_id UUID NOT NULL,
        channel VARCHAR(50) NOT NULL,
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        retry_count INTEGER NOT NULL DEFAULT 0,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Webhook configs table
    await queryRunner.query(`
      CREATE TABLE webhook_configs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        url VARCHAR(1024) NOT NULL,
        secret VARCHAR(255) NOT NULL,
        event_types TEXT[] NOT NULL,
        entity_types TEXT[] NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Webhook deliveries table
    await queryRunner.query(`
      CREATE TABLE webhook_deliveries (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        webhook_id UUID NOT NULL REFERENCES webhook_configs(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        response_status INTEGER,
        response_body TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        next_retry_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX idx_notifications_tenant_id ON notifications(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_notifications_tenant_user ON notifications(tenant_id, user_id)`);
    await queryRunner.query(`CREATE INDEX idx_notifications_status ON notifications(status)`);
    await queryRunner.query(`CREATE INDEX idx_webhook_configs_tenant_id ON webhook_configs(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id)`);
    await queryRunner.query(`CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status)`);
    await queryRunner.query(`CREATE INDEX idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at) WHERE status = 'pending'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS webhook_deliveries`);
    await queryRunner.query(`DROP TABLE IF EXISTS webhook_configs`);
    await queryRunner.query(`DROP TABLE IF EXISTS notifications`);
  }
}
