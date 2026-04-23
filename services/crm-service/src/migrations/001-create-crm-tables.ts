import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCrmTables1700000000001 implements MigrationInterface {
  name = 'CreateCrmTables1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Accounts table
    await queryRunner.query(`
      CREATE TABLE accounts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        industry VARCHAR(255),
        tax_id VARCHAR(100),
        phone VARCHAR(50),
        email VARCHAR(255),
        website VARCHAR(512),
        street VARCHAR(512),
        sub_district VARCHAR(255),
        district VARCHAR(255),
        province VARCHAR(255),
        postal_code VARCHAR(20),
        custom_fields JSONB DEFAULT '{}',
        created_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    // Contacts table
    await queryRunner.query(`
      CREATE TABLE contacts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        phone VARCHAR(50),
        email VARCHAR(255),
        line_id VARCHAR(255),
        custom_fields JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Notes table
    await queryRunner.query(`
      CREATE TABLE notes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID NOT NULL,
        content TEXT NOT NULL,
        author_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Attachments table
    await queryRunner.query(`
      CREATE TABLE attachments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        file_name VARCHAR(512) NOT NULL,
        file_url VARCHAR(1024) NOT NULL,
        file_size BIGINT NOT NULL,
        mime_type VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Tags table
    await queryRunner.query(`
      CREATE TABLE tags (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(20),
        UNIQUE(tenant_id, name)
      )
    `);

    // Account-Tag join table
    await queryRunner.query(`
      CREATE TABLE account_tags (
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (account_id, tag_id)
      )
    `);

    // Activities table
    await queryRunner.query(`
      CREATE TABLE activities (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID NOT NULL,
        summary TEXT NOT NULL,
        user_id UUID NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        metadata JSONB DEFAULT '{}'
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX idx_accounts_tenant_id ON accounts(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_contacts_tenant_id ON contacts(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_contacts_tenant_account ON contacts(tenant_id, account_id)`);
    await queryRunner.query(`CREATE INDEX idx_notes_tenant_id ON notes(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_notes_tenant_entity ON notes(tenant_id, entity_type, entity_id)`);
    await queryRunner.query(`CREATE INDEX idx_attachments_tenant_id ON attachments(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_tags_tenant_id ON tags(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_activities_tenant_id ON activities(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_activities_tenant_entity ON activities(tenant_id, entity_id)`);
    await queryRunner.query(`CREATE INDEX idx_activities_tenant_timestamp ON activities(tenant_id, timestamp)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS account_tags`);
    await queryRunner.query(`DROP TABLE IF EXISTS attachments`);
    await queryRunner.query(`DROP TABLE IF EXISTS activities`);
    await queryRunner.query(`DROP TABLE IF EXISTS notes`);
    await queryRunner.query(`DROP TABLE IF EXISTS tags`);
    await queryRunner.query(`DROP TABLE IF EXISTS contacts`);
    await queryRunner.query(`DROP TABLE IF EXISTS accounts`);
  }
}
