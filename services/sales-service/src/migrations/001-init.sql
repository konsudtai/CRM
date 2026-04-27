-- Sales Service: Initial Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  probability INTEGER NOT NULL DEFAULT 0,
  color VARCHAR(7) DEFAULT '#0176D3',
  UNIQUE(tenant_id, name)
);

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  line_id VARCHAR(100),
  source VARCHAR(50),
  status VARCHAR(50) DEFAULT 'New',
  assigned_to UUID,
  ai_score INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lead_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  factors JSONB DEFAULT '[]',
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  deal_name VARCHAR(255) NOT NULL,
  account_id UUID,
  contact_id UUID,
  estimated_value DECIMAL(15,2) DEFAULT 0,
  stage_id UUID REFERENCES pipeline_stages(id),
  weighted_value DECIMAL(15,2) DEFAULT 0,
  expected_close_date DATE,
  closed_reason VARCHAR(20),
  closed_notes TEXT,
  assigned_to UUID,
  ai_close_probability INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE opportunity_histories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  field_name VARCHAR(50) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sales_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  period VARCHAR(10) NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER,
  quarter INTEGER,
  target_amount DECIMAL(15,2) NOT NULL,
  achieved_amount DECIMAL(15,2) DEFAULT 0,
  UNIQUE(tenant_id, user_id, period, year, month, quarter)
);

-- RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_leads ON leads USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_opps ON opportunities USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_stages ON pipeline_stages USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_targets ON sales_targets USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Indexes
CREATE INDEX idx_leads_tenant ON leads(tenant_id);
CREATE INDEX idx_leads_status ON leads(tenant_id, status);
CREATE INDEX idx_leads_assigned ON leads(tenant_id, assigned_to);
CREATE INDEX idx_opps_tenant ON opportunities(tenant_id);
CREATE INDEX idx_opps_stage ON opportunities(tenant_id, stage_id);
CREATE INDEX idx_opps_close ON opportunities(tenant_id, expected_close_date);
