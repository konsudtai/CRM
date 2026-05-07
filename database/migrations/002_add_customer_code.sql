-- Migration 002: Add customer_code running number
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS customer_code VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_customer_code ON accounts(tenant_id, customer_code) WHERE customer_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  current_value INTEGER DEFAULT 0,
  UNIQUE(tenant_id)
);
