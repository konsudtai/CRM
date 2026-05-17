-- Migration 005: Add lead_code running number (L-0001, L-0002, ...)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_code VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_lead_code ON leads(tenant_id, lead_code) WHERE lead_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS lead_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  current_value INTEGER DEFAULT 0,
  UNIQUE(tenant_id)
);

-- Backfill existing leads with sequential codes
DO $$
DECLARE
  r RECORD;
  seq INTEGER := 0;
BEGIN
  FOR r IN SELECT id FROM leads WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND lead_code IS NULL ORDER BY created_at ASC
  LOOP
    seq := seq + 1;
    UPDATE leads SET lead_code = 'L-' || LPAD(seq::TEXT, 4, '0') WHERE id = r.id;
  END LOOP;
  -- Set sequence to current max
  INSERT INTO lead_sequences (tenant_id, current_value)
  VALUES ('00000000-0000-0000-0000-000000000001', seq)
  ON CONFLICT (tenant_id) DO UPDATE SET current_value = seq;
END $$;
