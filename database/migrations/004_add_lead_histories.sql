-- Migration 004: Add lead_histories table for tracking status changes
-- Records every status change with timestamp, who changed it, and optional notes

CREATE TABLE IF NOT EXISTS lead_histories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  field_name  VARCHAR(255) NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  changed_by  UUID REFERENCES users(id),
  changed_at  TIMESTAMPTZ DEFAULT NOW(),
  notes       TEXT
);

CREATE INDEX idx_lead_histories_lead_id ON lead_histories(lead_id);
CREATE INDEX idx_lead_histories_changed_at ON lead_histories(changed_at);
CREATE INDEX idx_lead_histories_field_new ON lead_histories(field_name, new_value);

-- Backfill: create initial history entry for all existing leads
INSERT INTO lead_histories (lead_id, field_name, old_value, new_value, changed_at, notes)
SELECT id, 'status', NULL, status, created_at, 'Backfill from migration'
FROM leads
WHERE NOT EXISTS (
  SELECT 1 FROM lead_histories lh WHERE lh.lead_id = leads.id
);
