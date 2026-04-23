import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthTables1700000000001 implements MigrationInterface {
  name = 'CreateAuthTables1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable uuid-ossp extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Tenants table (no tenant_id — this is the root entity)
    await queryRunner.query(`
      CREATE TABLE tenants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        settings JSONB DEFAULT '{}',
        line_channel_token VARCHAR(512),
        line_channel_secret VARCHAR(512),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Users table
    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        line_id VARCHAR(255),
        mfa_enabled BOOLEAN NOT NULL DEFAULT false,
        mfa_secret VARCHAR(255),
        sso_provider VARCHAR(100),
        sso_subject VARCHAR(255),
        preferred_language VARCHAR(10) NOT NULL DEFAULT 'th',
        preferred_calendar VARCHAR(20) NOT NULL DEFAULT 'buddhist',
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, email)
      )
    `);

    // Roles table
    await queryRunner.query(`
      CREATE TABLE roles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, name)
      )
    `);

    // Role permissions table
    await queryRunner.query(`
      CREATE TABLE role_permissions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        module VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        UNIQUE(role_id, module, action)
      )
    `);

    // User-role join table
    await queryRunner.query(`
      CREATE TABLE user_roles (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
      )
    `);

    // Indexes for common queries
    await queryRunner.query(`CREATE INDEX idx_users_tenant_id ON users(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_roles_tenant_id ON roles(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id)`);
    await queryRunner.query(`CREATE INDEX idx_user_roles_user_id ON user_roles(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_user_roles_role_id ON user_roles(role_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_roles`);
    await queryRunner.query(`DROP TABLE IF EXISTS role_permissions`);
    await queryRunner.query(`DROP TABLE IF EXISTS roles`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenants`);
  }
}
