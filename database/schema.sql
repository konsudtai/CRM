-- ============================================================
-- SalesFAST 7 — Complete PostgreSQL Schema
-- Single database, multi-tenant with RLS
-- User auth via bcrypt + JWT (no Cognito)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";  -- pgvector for AI embeddings

-- ============================================================
-- 1. TENANTS & AUTH (Cognito-integrated)
-- ============================================================

CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(255) NOT NULL UNIQUE,
  settings      JSONB DEFAULT '{}',
  line_channel_token  VARCHAR(512),
  line_channel_secret VARCHAR(512),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Users: password stored as bcrypt hash in DB
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  email               VARCHAR(255) NOT NULL,
  password_hash       VARCHAR(255) NOT NULL,        -- bcrypt, cost 12
  first_name          VARCHAR(255),
  last_name           VARCHAR(255),
  phone               VARCHAR(50),
  line_id             VARCHAR(255),
  mfa_enabled         BOOLEAN DEFAULT false,
  mfa_secret          VARCHAR(255),                 -- TOTP secret
  preferred_language  VARCHAR(5) DEFAULT 'th',
  preferred_calendar  VARCHAR(20) DEFAULT 'buddhist',
  is_active           BOOLEAN DEFAULT true,
  force_password_change BOOLEAN DEFAULT true,       -- must change on first login
  failed_login_count  INTEGER DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  last_login_at       TIMESTAMPTZ,
  last_login_ip       VARCHAR(45),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  name        VARCHAR(100) NOT NULL,
  is_default  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE TABLE role_permissions (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id   UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module    VARCHAR(100) NOT NULL,
  action    VARCHAR(50) NOT NULL,
  UNIQUE(role_id, module, action)
);

CREATE TABLE user_roles (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id   UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE(user_id, role_id)
);

CREATE TABLE api_keys (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  name        VARCHAR(255) NOT NULL,
  key_hash    VARCHAR(64) NOT NULL UNIQUE,
  key_prefix  VARCHAR(8) NOT NULL,
  status      VARCHAR(50) DEFAULT 'active',
  expires_at  TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ip_allowlist_entries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  address     VARCHAR(45) NOT NULL,
  description VARCHAR(255),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. CRM — Accounts, Contacts, Activities
-- ============================================================

-- ============================================================
-- 2. ACCOUNTS (Customer) — Core entity of the CRM
-- ทุก module อ้างอิงกลับมาที่ Account เสมอ
-- ============================================================

CREATE TABLE accounts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),

  -- === Company Info ===
  company_name      VARCHAR(255) NOT NULL,
  company_name_en   VARCHAR(255),                   -- ชื่อภาษาอังกฤษ
  company_type      VARCHAR(50),                    -- บจก., หจก., บมจ., ร้านค้า, บุคคลธรรมดา
  industry          VARCHAR(255),
  business_desc     TEXT,                           -- รายละเอียดธุรกิจ

  -- === Tax & Registration ===
  tax_id            VARCHAR(13),                    -- เลขประจำตัวผู้เสียภาษี (13 หลัก)
  branch_code       VARCHAR(10) DEFAULT '00000',    -- รหัสสาขา (00000 = สำนักงานใหญ่)
  branch_name       VARCHAR(100),                   -- ชื่อสาขา
  registered_capital DECIMAL(15,2),                 -- ทุนจดทะเบียน (บาท)
  registration_date DATE,                           -- วันที่จดทะเบียน
  registration_no   VARCHAR(50),                    -- เลขทะเบียนนิติบุคคล

  -- === Contact Info ===
  phone             VARCHAR(50),
  phone2            VARCHAR(50),                    -- เบอร์สำรอง
  fax               VARCHAR(50),
  email             VARCHAR(255),
  website           VARCHAR(512),
  line_oa_id        VARCHAR(100),                   -- LINE Official Account ID

  -- === Address (Thai format) ===
  address           TEXT,                           -- เลขที่ / อาคาร / ซอย / ถนน
  sub_district      VARCHAR(255),                   -- ตำบล / แขวง
  district          VARCHAR(255),                   -- อำเภอ / เขต
  province          VARCHAR(255),                   -- จังหวัด
  postal_code       VARCHAR(10),
  country           VARCHAR(100) DEFAULT 'Thailand',

  -- === Shipping Address (if different) ===
  shipping_address      TEXT,
  shipping_sub_district VARCHAR(255),
  shipping_district     VARCHAR(255),
  shipping_province     VARCHAR(255),
  shipping_postal_code  VARCHAR(10),

  -- === Sales Info ===
  account_owner     UUID REFERENCES users(id),      -- เจ้าของบัญชี (Sales Rep)
  account_status    VARCHAR(30) DEFAULT 'active',   -- active, inactive, prospect, churned
  account_source    VARCHAR(100),                   -- แหล่งที่มา: website, referral, event, cold-call
  account_tier      VARCHAR(20) DEFAULT 'standard', -- standard, silver, gold, platinum
  credit_term       INTEGER DEFAULT 30,             -- เครดิตเทอม (วัน)
  credit_limit      DECIMAL(15,2),                  -- วงเงินเครดิต
  payment_method    VARCHAR(50),                    -- transfer, cheque, cash, credit

  -- === Financial Summary (auto-calculated) ===
  total_revenue     DECIMAL(15,2) DEFAULT 0,        -- รายได้รวมจาก closed-won deals
  total_deals       INTEGER DEFAULT 0,
  last_activity_at  TIMESTAMPTZ,

  -- === Notes ===
  internal_notes    TEXT,                           -- หมายเหตุภายใน
  custom_fields     JSONB DEFAULT '{}',             -- ฟิลด์เพิ่มเติมตามต้องการ

  -- === Metadata ===
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ                     -- soft delete
);

-- ============================================================
-- CONTACTS — บุคคลติดต่อ (ผูกกับ Account)
-- ============================================================

CREATE TABLE contacts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  account_id        UUID NOT NULL REFERENCES accounts(id),

  -- === Personal Info ===
  prefix            VARCHAR(20),                    -- คุณ, นาย, นาง, นางสาว, ดร.
  first_name        VARCHAR(255) NOT NULL,
  last_name         VARCHAR(255) NOT NULL,
  nickname          VARCHAR(100),
  title             VARCHAR(255),                   -- ตำแหน่ง
  department        VARCHAR(255),                   -- แผนก
  role_in_company   VARCHAR(100),                   -- decision_maker, influencer, user, gatekeeper

  -- === Contact Info ===
  phone             VARCHAR(50),
  mobile            VARCHAR(50),
  email             VARCHAR(255),
  line_id           VARCHAR(255),

  -- === Flags ===
  is_primary        BOOLEAN DEFAULT false,          -- ผู้ติดต่อหลัก
  is_billing        BOOLEAN DEFAULT false,          -- ผู้ติดต่อด้านบัญชี
  is_active         BOOLEAN DEFAULT true,

  -- === Notes ===
  notes             TEXT,
  custom_fields     JSONB DEFAULT '{}',

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SHAREHOLDERS — ผู้ถือหุ้น / กรรมการ (ผูกกับ Account)
-- ============================================================

CREATE TABLE account_shareholders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  full_name         VARCHAR(255) NOT NULL,
  id_card           VARCHAR(13),                    -- เลขบัตรประชาชน
  nationality       VARCHAR(100) DEFAULT 'Thai',
  share_percentage  DECIMAL(5,2),                   -- % หุ้น
  share_amount      DECIMAL(15,2),                  -- จำนวนหุ้น (บาท)
  position          VARCHAR(100),                   -- กรรมการ, กรรมการผู้จัดการ, ผู้ถือหุ้น
  is_authorized     BOOLEAN DEFAULT false,          -- กรรมการผู้มีอำนาจลงนาม
  phone             VARCHAR(50),
  email             VARCHAR(255),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACCOUNT DOCUMENTS — เอกสารบริษัท (หนังสือรับรอง, ภพ.20, etc.)
-- ============================================================

CREATE TABLE account_documents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  doc_type          VARCHAR(50) NOT NULL,           -- certificate, vat_registration, id_card, contract, other
  doc_name          VARCHAR(255) NOT NULL,
  file_url          VARCHAR(1024) NOT NULL,         -- S3 URL
  file_size         BIGINT,
  expiry_date       DATE,                           -- วันหมดอายุ (ถ้ามี)
  notes             VARCHAR(512),
  uploaded_by       UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  name        VARCHAR(100) NOT NULL,
  color       VARCHAR(20),
  UNIQUE(tenant_id, name)
);

CREATE TABLE account_tags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(account_id, tag_id)
);

CREATE TABLE activities (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  entity_type VARCHAR(50) NOT NULL,               -- 'account','contact','lead','opportunity'
  entity_id   UUID NOT NULL,
  summary     TEXT,
  user_id     UUID REFERENCES users(id),
  timestamp   TIMESTAMPTZ DEFAULT NOW(),
  metadata    JSONB DEFAULT '{}'
);

CREATE TABLE notes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  entity_type VARCHAR(50) NOT NULL,
  entity_id   UUID NOT NULL,
  content     TEXT NOT NULL,
  author_id   UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attachments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  note_id     UUID REFERENCES notes(id) ON DELETE CASCADE,
  file_name   VARCHAR(512) NOT NULL,
  file_url    VARCHAR(1024) NOT NULL,
  file_size   BIGINT,
  mime_type   VARCHAR(255),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  due_date        DATE,
  priority        VARCHAR(20) DEFAULT 'Medium',   -- High, Medium, Low
  status          VARCHAR(20) DEFAULT 'Open',     -- Open, In Progress, Completed, Overdue
  assigned_to     UUID REFERENCES users(id),
  account_id      UUID REFERENCES accounts(id),
  contact_id      UUID REFERENCES contacts(id),
  opportunity_id  UUID,                           -- cross-service ref
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. SALES — Leads, Opportunities, Pipeline
-- ============================================================

CREATE TABLE pipeline_stages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  name        VARCHAR(255) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  probability INTEGER NOT NULL DEFAULT 0,         -- 0-100
  color       VARCHAR(20) DEFAULT '#0176D3',
  UNIQUE(tenant_id, name)
);

CREATE TABLE leads (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  name          VARCHAR(255) NOT NULL,
  company_name  VARCHAR(255),
  email         VARCHAR(255),
  phone         VARCHAR(50),
  line_id       VARCHAR(255),
  source        VARCHAR(100),
  status        VARCHAR(50) DEFAULT 'New',
  assigned_to   UUID REFERENCES users(id),
  ai_score      INTEGER,                          -- AI Lead Score 0-100 (set by น้องขายไว)
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE opportunities (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  deal_name             VARCHAR(255) NOT NULL,
  account_id            UUID NOT NULL REFERENCES accounts(id),
  contact_id            UUID REFERENCES contacts(id),
  estimated_value       DECIMAL(15,2) DEFAULT 0,
  stage_id              UUID NOT NULL REFERENCES pipeline_stages(id),
  weighted_value        DECIMAL(15,2) DEFAULT 0,
  expected_close_date   DATE,
  closed_reason         VARCHAR(255),
  closed_notes          TEXT,
  assigned_to           UUID NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE opportunity_histories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id  UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  field_name      VARCHAR(255) NOT NULL,
  old_value       TEXT,
  new_value       TEXT,
  changed_by      UUID REFERENCES users(id),
  changed_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sales_targets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  period          VARCHAR(20) NOT NULL,           -- 'monthly','quarterly'
  year            INTEGER NOT NULL,
  month           INTEGER,
  quarter         INTEGER,
  target_amount   DECIMAL(15,2) NOT NULL,
  achieved_amount DECIMAL(15,2) DEFAULT 0,
  UNIQUE(tenant_id, user_id, period, year, month, quarter)
);

-- ============================================================
-- 4. QUOTATIONS — Products, Quotations
-- ============================================================

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(255) NOT NULL,
  sku             VARCHAR(100) NOT NULL,
  description     TEXT,
  unit_price      DECIMAL(12,2) NOT NULL,
  unit_of_measure VARCHAR(50),
  wht_rate        DECIMAL(5,2),                   -- 0, 1, 2, 3, 5
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, sku)
);

CREATE TABLE quotations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  quotation_number  VARCHAR(50) NOT NULL,
  account_id        UUID NOT NULL REFERENCES accounts(id),
  contact_id        UUID REFERENCES contacts(id),
  opportunity_id    UUID REFERENCES opportunities(id),
  subtotal          DECIMAL(14,2) DEFAULT 0,
  total_discount    DECIMAL(14,2) DEFAULT 0,
  vat_amount        DECIMAL(14,2) DEFAULT 0,      -- 7%
  wht_amount        DECIMAL(14,2) DEFAULT 0,
  grand_total       DECIMAL(14,2) DEFAULT 0,
  status            VARCHAR(30) DEFAULT 'draft',  -- draft, pending_approval, sent, accepted, rejected, expired
  pdf_url           VARCHAR(1024),
  valid_until       DATE,
  created_by        UUID NOT NULL REFERENCES users(id),
  approved_by       UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, quotation_number)
);

CREATE TABLE quotation_line_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id    UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  product_name    VARCHAR(255) NOT NULL,
  sku             VARCHAR(100),
  quantity        INTEGER NOT NULL,
  unit_price      DECIMAL(12,2) NOT NULL,
  discount        DECIMAL(12,2) DEFAULT 0,
  discount_type   VARCHAR(20) DEFAULT 'fixed',    -- 'fixed','percentage'
  wht_rate        DECIMAL(5,2) DEFAULT 0,
  line_total      DECIMAL(14,2) DEFAULT 0
);

CREATE TABLE quotation_sequences (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  prefix        VARCHAR(20) NOT NULL,
  current_value INTEGER DEFAULT 0,
  year          INTEGER NOT NULL,
  UNIQUE(tenant_id, prefix, year)
);

-- ============================================================
-- 5. NOTIFICATIONS — Notifications, Webhooks
-- ============================================================

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  channel     VARCHAR(50) NOT NULL,               -- 'line','email','in_app'
  type        VARCHAR(100) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  body        TEXT,
  metadata    JSONB DEFAULT '{}',
  status      VARCHAR(50) DEFAULT 'pending',      -- pending, sent, delivered, failed
  retry_count INTEGER DEFAULT 0,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_configs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  url           VARCHAR(1024) NOT NULL,
  secret        VARCHAR(255) NOT NULL,
  event_types   TEXT[] NOT NULL,
  entity_types  TEXT[] NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id      UUID NOT NULL REFERENCES webhook_configs(id) ON DELETE CASCADE,
  event_type      VARCHAR(100) NOT NULL,
  payload         JSONB NOT NULL,
  response_status INTEGER,
  response_body   TEXT,
  status          VARCHAR(50) DEFAULT 'pending',
  attempts        INTEGER DEFAULT 0,
  next_retry_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. COMPLIANCE — Audit, Consent (PDPA)
-- ============================================================

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  user_id     UUID REFERENCES users(id),
  entity_type VARCHAR(100) NOT NULL,
  entity_id   UUID NOT NULL,
  action      VARCHAR(20) NOT NULL,               -- create, update, delete, login
  old_values  JSONB,
  new_values  JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE consent_records (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  contact_id  UUID NOT NULL REFERENCES contacts(id),
  purpose     VARCHAR(255) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'granted',
  granted_at  DATE,
  expires_at  DATE,
  withdrawn_at DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. INTEGRATIONS — Email Sync, Calendar Sync
-- ============================================================

CREATE TABLE email_syncs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  user_id               UUID NOT NULL REFERENCES users(id),
  provider              VARCHAR(20) NOT NULL,       -- 'gmail','outlook'
  status                VARCHAR(50) DEFAULT 'disconnected',
  access_token          TEXT,
  refresh_token         TEXT,
  token_expires_at      TIMESTAMPTZ,
  last_sync_at          TIMESTAMPTZ,
  last_error            VARCHAR(255),
  consecutive_failures  INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE calendar_syncs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  user_id               UUID NOT NULL REFERENCES users(id),
  provider              VARCHAR(30) NOT NULL,       -- 'google','microsoft'
  status                VARCHAR(50) DEFAULT 'disconnected',
  access_token          TEXT,
  refresh_token         TEXT,
  token_expires_at      TIMESTAMPTZ,
  last_sync_at          TIMESTAMPTZ,
  last_error            VARCHAR(255),
  consecutive_failures  INTEGER DEFAULT 0,
  calendar_id           VARCHAR(255),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. AI KNOWLEDGE BASE (pgvector)
-- ============================================================

CREATE TABLE kb_documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  file_name       VARCHAR(255) NOT NULL,
  file_type       VARCHAR(50) NOT NULL,
  file_size       BIGINT,
  file_url        VARCHAR(1024),
  category        VARCHAR(50) DEFAULT 'general',
  status          VARCHAR(30) DEFAULT 'processing',
  chunk_count     INTEGER DEFAULT 0,
  uploaded_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kb_chunks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id     UUID NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  chunk_index     INTEGER NOT NULL,
  content         TEXT NOT NULL,
  token_count     INTEGER,
  embedding       vector(1536),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kb_chunks_embedding ON kb_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_kb_chunks_tenant ON kb_chunks(tenant_id);
CREATE INDEX idx_kb_chunks_doc ON kb_chunks(document_id);
CREATE INDEX idx_kb_documents_tenant ON kb_documents(tenant_id);

CREATE TABLE ai_config (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  enabled         BOOLEAN DEFAULT false,
  bedrock_region  VARCHAR(30) DEFAULT 'us-east-1',
  model_id        VARCHAR(100) DEFAULT 'anthropic.claude-3-haiku-20240307-v1:0',
  embedding_model VARCHAR(100) DEFAULT 'amazon.titan-embed-text-v2:0',
  temperature     DECIMAL(3,2) DEFAULT 0.3,
  max_tokens      INTEGER DEFAULT 2048,
  system_prompt   TEXT,
  ai_name         VARCHAR(100) DEFAULT 'น้องขายไว',
  line_ai_enabled BOOLEAN DEFAULT false,
  line_ai_name    VARCHAR(100) DEFAULT 'Admin AI',
  kb_last_synced  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- ============================================================
-- 9. ROW-LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_allowlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_shareholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_syncs ENABLE ROW LEVEL SECURITY;

-- RLS policies: every table with tenant_id
CREATE POLICY rls_users ON users USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_roles ON roles USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_api_keys ON api_keys USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_ip_allowlist ON ip_allowlist_entries USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_accounts ON accounts USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_contacts ON contacts USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_account_shareholders ON account_shareholders USING (
  account_id IN (SELECT id FROM accounts WHERE tenant_id = current_setting('app.current_tenant')::uuid)
);
CREATE POLICY rls_account_documents ON account_documents USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_tags ON tags USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_activities ON activities USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_notes ON notes USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_attachments ON attachments USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_tasks ON tasks USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_pipeline_stages ON pipeline_stages USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_leads ON leads USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_opportunities ON opportunities USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_sales_targets ON sales_targets USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_products ON products USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_quotations ON quotations USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_notifications ON notifications USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_webhook_configs ON webhook_configs USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_audit_logs ON audit_logs USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_consent_records ON consent_records USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_email_syncs ON email_syncs USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_calendar_syncs ON calendar_syncs USING (tenant_id = current_setting('app.current_tenant')::uuid);
ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_kb_documents ON kb_documents USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_kb_chunks ON kb_chunks USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_ai_config ON ai_config USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Join tables: RLS via parent
CREATE POLICY rls_role_permissions ON role_permissions USING (
  role_id IN (SELECT id FROM roles WHERE tenant_id = current_setting('app.current_tenant')::uuid)
);
CREATE POLICY rls_user_roles ON user_roles USING (
  user_id IN (SELECT id FROM users WHERE tenant_id = current_setting('app.current_tenant')::uuid)
);
CREATE POLICY rls_account_tags ON account_tags USING (
  account_id IN (SELECT id FROM accounts WHERE tenant_id = current_setting('app.current_tenant')::uuid)
);
CREATE POLICY rls_opp_histories ON opportunity_histories USING (
  opportunity_id IN (SELECT id FROM opportunities WHERE tenant_id = current_setting('app.current_tenant')::uuid)
);
CREATE POLICY rls_qt_line_items ON quotation_line_items USING (
  quotation_id IN (SELECT id FROM quotations WHERE tenant_id = current_setting('app.current_tenant')::uuid)
);
CREATE POLICY rls_qt_sequences ON quotation_sequences USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY rls_webhook_deliveries ON webhook_deliveries USING (
  webhook_id IN (SELECT id FROM webhook_configs WHERE tenant_id = current_setting('app.current_tenant')::uuid)
);

-- ============================================================
-- 9. INDEXES
-- ============================================================

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(tenant_id, email);
CREATE INDEX idx_accounts_tenant ON accounts(tenant_id);
CREATE INDEX idx_accounts_name ON accounts(tenant_id, company_name);
CREATE INDEX idx_accounts_tax ON accounts(tenant_id, tax_id);
CREATE INDEX idx_accounts_status ON accounts(tenant_id, account_status);
CREATE INDEX idx_accounts_owner ON accounts(tenant_id, account_owner);
CREATE INDEX idx_accounts_tier ON accounts(tenant_id, account_tier);
CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_account ON contacts(account_id);
CREATE INDEX idx_contacts_primary ON contacts(account_id, is_primary) WHERE is_primary = true;
CREATE INDEX idx_shareholders_account ON account_shareholders(account_id);
CREATE INDEX idx_account_docs ON account_documents(account_id);
CREATE INDEX idx_activities_entity ON activities(tenant_id, entity_type, entity_id);
CREATE INDEX idx_activities_ts ON activities(tenant_id, timestamp DESC);
CREATE INDEX idx_notes_entity ON notes(tenant_id, entity_type, entity_id);
CREATE INDEX idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX idx_tasks_assigned ON tasks(tenant_id, assigned_to);
CREATE INDEX idx_tasks_due ON tasks(tenant_id, due_date);
CREATE INDEX idx_tasks_status ON tasks(tenant_id, status);
CREATE INDEX idx_leads_tenant ON leads(tenant_id);
CREATE INDEX idx_leads_status ON leads(tenant_id, status);
CREATE INDEX idx_leads_assigned ON leads(tenant_id, assigned_to);
CREATE INDEX idx_opps_tenant ON opportunities(tenant_id);
CREATE INDEX idx_opps_stage ON opportunities(tenant_id, stage_id);
CREATE INDEX idx_opps_close ON opportunities(tenant_id, expected_close_date);
CREATE INDEX idx_opps_assigned ON opportunities(tenant_id, assigned_to);
CREATE INDEX idx_quotations_tenant ON quotations(tenant_id);
CREATE INDEX idx_quotations_status ON quotations(tenant_id, status);
CREATE INDEX idx_notifications_user ON notifications(tenant_id, user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_audit_entity ON audit_logs(tenant_id, entity_type, entity_id);
CREATE INDEX idx_audit_ts ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_consent_contact ON consent_records(tenant_id, contact_id);

-- ============================================================
-- 10. SEED: Default Pipeline Stages (per tenant)
-- ============================================================
-- Run after creating a tenant:
-- INSERT INTO pipeline_stages (tenant_id, name, sort_order, probability, color) VALUES
--   (:tid, 'New Lead',       1, 10, '#64748B'),
--   (:tid, 'Qualification',  2, 20, '#0176D3'),
--   (:tid, 'Needs Analysis', 3, 40, '#0B827C'),
--   (:tid, 'Proposal',       4, 60, '#D97706'),
--   (:tid, 'Negotiation',    5, 80, '#DC2626'),
--   (:tid, 'Closed Won',     6, 100,'#2E844A'),
--   (:tid, 'Closed Lost',    7, 0,  '#9CA3AF');

-- Default Roles (per tenant):
-- INSERT INTO roles (tenant_id, name, is_default) VALUES
--   (:tid, 'Admin', true),
--   (:tid, 'Sales Manager', true),
--   (:tid, 'Sales Rep', true),
--   (:tid, 'Viewer', true);
