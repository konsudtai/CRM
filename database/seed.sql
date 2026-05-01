-- ============================================================
-- SalesFAST 7 — Initial Seed Data
-- Run after schema.sql
-- Creates first tenant + admin user + default roles
--
-- Placeholders (replaced by deploy.sh):
--   __ADMIN_EMAIL__         -> admin email address
--   __ADMIN_PASSWORD_HASH__ -> bcrypt hash of admin password
--   __ADMIN_FIRST_NAME__    -> admin first name
--   __ADMIN_LAST_NAME__     -> admin last name
--   __TENANT_NAME__         -> company/tenant name
-- ============================================================

-- 1. Create first tenant
INSERT INTO tenants (id, name, slug, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', '__TENANT_NAME__', 'admin', true);

-- 2. Create default roles
INSERT INTO roles (id, tenant_id, name, is_default) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Admin', true),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Sales Manager', true),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Sales Rep', true),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Viewer', true);

-- 3. Admin role: full permissions on all modules
INSERT INTO role_permissions (role_id, module, action) VALUES
  -- Admin: everything
  ('00000000-0000-0000-0000-000000000010', 'accounts', 'create'),
  ('00000000-0000-0000-0000-000000000010', 'accounts', 'read'),
  ('00000000-0000-0000-0000-000000000010', 'accounts', 'update'),
  ('00000000-0000-0000-0000-000000000010', 'accounts', 'delete'),
  ('00000000-0000-0000-0000-000000000010', 'contacts', 'create'),
  ('00000000-0000-0000-0000-000000000010', 'contacts', 'read'),
  ('00000000-0000-0000-0000-000000000010', 'contacts', 'update'),
  ('00000000-0000-0000-0000-000000000010', 'contacts', 'delete'),
  ('00000000-0000-0000-0000-000000000010', 'leads', 'create'),
  ('00000000-0000-0000-0000-000000000010', 'leads', 'read'),
  ('00000000-0000-0000-0000-000000000010', 'leads', 'update'),
  ('00000000-0000-0000-0000-000000000010', 'leads', 'delete'),
  ('00000000-0000-0000-0000-000000000010', 'opportunities', 'create'),
  ('00000000-0000-0000-0000-000000000010', 'opportunities', 'read'),
  ('00000000-0000-0000-0000-000000000010', 'opportunities', 'update'),
  ('00000000-0000-0000-0000-000000000010', 'opportunities', 'delete'),
  ('00000000-0000-0000-0000-000000000010', 'quotations', 'create'),
  ('00000000-0000-0000-0000-000000000010', 'quotations', 'read'),
  ('00000000-0000-0000-0000-000000000010', 'quotations', 'update'),
  ('00000000-0000-0000-0000-000000000010', 'quotations', 'delete'),
  ('00000000-0000-0000-0000-000000000010', 'tasks', 'create'),
  ('00000000-0000-0000-0000-000000000010', 'tasks', 'read'),
  ('00000000-0000-0000-0000-000000000010', 'tasks', 'update'),
  ('00000000-0000-0000-0000-000000000010', 'tasks', 'delete'),
  ('00000000-0000-0000-0000-000000000010', 'reports', 'read'),
  ('00000000-0000-0000-0000-000000000010', 'users', 'create'),
  ('00000000-0000-0000-0000-000000000010', 'users', 'read'),
  ('00000000-0000-0000-0000-000000000010', 'users', 'update'),
  ('00000000-0000-0000-0000-000000000010', 'users', 'delete'),
  ('00000000-0000-0000-0000-000000000010', 'settings', 'read'),
  ('00000000-0000-0000-0000-000000000010', 'settings', 'update'),
  -- Sales Manager: CRU on most, no delete, no user management
  ('00000000-0000-0000-0000-000000000011', 'accounts', 'create'),
  ('00000000-0000-0000-0000-000000000011', 'accounts', 'read'),
  ('00000000-0000-0000-0000-000000000011', 'accounts', 'update'),
  ('00000000-0000-0000-0000-000000000011', 'contacts', 'create'),
  ('00000000-0000-0000-0000-000000000011', 'contacts', 'read'),
  ('00000000-0000-0000-0000-000000000011', 'contacts', 'update'),
  ('00000000-0000-0000-0000-000000000011', 'leads', 'create'),
  ('00000000-0000-0000-0000-000000000011', 'leads', 'read'),
  ('00000000-0000-0000-0000-000000000011', 'leads', 'update'),
  ('00000000-0000-0000-0000-000000000011', 'leads', 'delete'),
  ('00000000-0000-0000-0000-000000000011', 'opportunities', 'create'),
  ('00000000-0000-0000-0000-000000000011', 'opportunities', 'read'),
  ('00000000-0000-0000-0000-000000000011', 'opportunities', 'update'),
  ('00000000-0000-0000-0000-000000000011', 'opportunities', 'delete'),
  ('00000000-0000-0000-0000-000000000011', 'quotations', 'create'),
  ('00000000-0000-0000-0000-000000000011', 'quotations', 'read'),
  ('00000000-0000-0000-0000-000000000011', 'quotations', 'update'),
  ('00000000-0000-0000-0000-000000000011', 'tasks', 'create'),
  ('00000000-0000-0000-0000-000000000011', 'tasks', 'read'),
  ('00000000-0000-0000-0000-000000000011', 'tasks', 'update'),
  ('00000000-0000-0000-0000-000000000011', 'tasks', 'delete'),
  ('00000000-0000-0000-0000-000000000011', 'reports', 'read'),
  -- Sales Rep: CR on most, no settings/users
  ('00000000-0000-0000-0000-000000000012', 'accounts', 'create'),
  ('00000000-0000-0000-0000-000000000012', 'accounts', 'read'),
  ('00000000-0000-0000-0000-000000000012', 'contacts', 'create'),
  ('00000000-0000-0000-0000-000000000012', 'contacts', 'read'),
  ('00000000-0000-0000-0000-000000000012', 'leads', 'create'),
  ('00000000-0000-0000-0000-000000000012', 'leads', 'read'),
  ('00000000-0000-0000-0000-000000000012', 'leads', 'update'),
  ('00000000-0000-0000-0000-000000000012', 'opportunities', 'create'),
  ('00000000-0000-0000-0000-000000000012', 'opportunities', 'read'),
  ('00000000-0000-0000-0000-000000000012', 'opportunities', 'update'),
  ('00000000-0000-0000-0000-000000000012', 'quotations', 'create'),
  ('00000000-0000-0000-0000-000000000012', 'quotations', 'read'),
  ('00000000-0000-0000-0000-000000000012', 'tasks', 'create'),
  ('00000000-0000-0000-0000-000000000012', 'tasks', 'read'),
  ('00000000-0000-0000-0000-000000000012', 'tasks', 'update'),
  ('00000000-0000-0000-0000-000000000012', 'reports', 'read'),
  -- Viewer: read only
  ('00000000-0000-0000-0000-000000000013', 'accounts', 'read'),
  ('00000000-0000-0000-0000-000000000013', 'contacts', 'read'),
  ('00000000-0000-0000-0000-000000000013', 'leads', 'read'),
  ('00000000-0000-0000-0000-000000000013', 'opportunities', 'read'),
  ('00000000-0000-0000-0000-000000000013', 'quotations', 'read'),
  ('00000000-0000-0000-0000-000000000013', 'tasks', 'read'),
  ('00000000-0000-0000-0000-000000000013', 'reports', 'read');

-- 4. Create admin user
INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, is_active, force_password_change) VALUES
  ('00000000-0000-0000-0000-000000000100',
   '00000000-0000-0000-0000-000000000001',
   '__ADMIN_EMAIL__',
   '__ADMIN_PASSWORD_HASH__',
   '__ADMIN_FIRST_NAME__',
   '__ADMIN_LAST_NAME__',
   true,
   true);

-- 5. Assign Admin role to admin user
INSERT INTO user_roles (user_id, role_id) VALUES
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000010');

-- 6. Default pipeline stages
INSERT INTO pipeline_stages (tenant_id, name, sort_order, probability, color) VALUES
  ('00000000-0000-0000-0000-000000000001', 'New Lead',       1, 10, '#64748B'),
  ('00000000-0000-0000-0000-000000000001', 'Qualification',  2, 20, '#0176D3'),
  ('00000000-0000-0000-0000-000000000001', 'Needs Analysis', 3, 40, '#0B827C'),
  ('00000000-0000-0000-0000-000000000001', 'Proposal',       4, 60, '#D97706'),
  ('00000000-0000-0000-0000-000000000001', 'Negotiation',    5, 80, '#DC2626'),
  ('00000000-0000-0000-0000-000000000001', 'Closed Won',     6, 100,'#2E844A'),
  ('00000000-0000-0000-0000-000000000001', 'Closed Lost',    7, 0,  '#9CA3AF');

-- ============================================================
-- Login with the email and password you configured during deploy.
-- The system will prompt you to change password on first login.
-- ============================================================
