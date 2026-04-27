-- Auth Service: Initial Schema
-- Run against auth_service database

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  line_channel_token VARCHAR(512),
  line_channel_secret VARCHAR(512),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  phone VARCHAR(50),
  line_id VARCHAR(255),
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_secret VARCHAR(255),
  sso_provider VARCHAR(50),
  sso_subject VARCHAR(255),
  preferred_language VARCHAR(5) DEFAULT 'th',
  preferred_calendar VARCHAR(10) DEFAULT 'buddhist',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL,
  UNIQUE(role_id, module, action)
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE(user_id, role_id)
);

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ip_allowlist_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  address VARCHAR(45) NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_allowlist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_users ON users USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_roles ON roles USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_api_keys ON api_keys USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_ip_allowlist ON ip_allowlist_entries USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Indexes
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(tenant_id, email);
CREATE INDEX idx_roles_tenant ON roles(tenant_id);
