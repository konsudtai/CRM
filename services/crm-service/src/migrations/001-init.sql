-- CRM Service: Initial Schema
-- Run against crm_service database

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  industry VARCHAR(100),
  tax_id VARCHAR(20),
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  street TEXT,
  sub_district VARCHAR(100),
  district VARCHAR(100),
  province VARCHAR(100),
  postal_code VARCHAR(10),
  custom_fields JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  account_id UUID REFERENCES accounts(id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  title VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(255),
  line_id VARCHAR(100),
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#0176D3',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE TABLE account_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(account_id, tag_id)
);

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  summary TEXT,
  metadata JSONB DEFAULT '{}',
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  s3_key VARCHAR(512) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE,
  priority VARCHAR(10) DEFAULT 'Medium',
  status VARCHAR(20) DEFAULT 'Open',
  assigned_to UUID,
  account_id UUID REFERENCES accounts(id),
  contact_id UUID REFERENCES contacts(id),
  opportunity_id UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE consent_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  purpose VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'granted',
  granted_at DATE,
  expires_at DATE,
  withdrawn_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_syncs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  provider VARCHAR(20) NOT NULL,
  provider_account VARCHAR(255),
  access_token TEXT,
  refresh_token TEXT,
  sync_cursor VARCHAR(255),
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE calendar_syncs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  provider VARCHAR(20) NOT NULL,
  provider_account VARCHAR(255),
  access_token TEXT,
  refresh_token TEXT,
  sync_cursor VARCHAR(255),
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_accounts ON accounts USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_contacts ON contacts USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_tasks ON tasks USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_activities ON activities USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_notes ON notes USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_tags ON tags USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_audit ON audit_logs USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_consent ON consent_records USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Indexes
CREATE INDEX idx_accounts_tenant ON accounts(tenant_id);
CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_account ON contacts(account_id);
CREATE INDEX idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX idx_tasks_assigned ON tasks(tenant_id, assigned_to);
CREATE INDEX idx_tasks_due ON tasks(tenant_id, due_date);
CREATE INDEX idx_activities_entity ON activities(tenant_id, entity_type, entity_id);
CREATE INDEX idx_audit_entity ON audit_logs(tenant_id, entity_type, entity_id);
