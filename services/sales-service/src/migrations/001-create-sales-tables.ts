import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSalesTables1700000000001 implements MigrationInterface {
  name = 'CreateSalesTables1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Pipeline stages table
    await queryRunner.query(`
      CREATE TABLE pipeline_stages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        sort_order INTEGER NOT NULL,
        probability INTEGER NOT NULL DEFAULT 0,
        color VARCHAR(20) NOT NULL DEFAULT '#0071e3'
      )
    `);

    // Leads table
    await queryRunner.query(`
      CREATE TABLE leads (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        company_name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        line_id VARCHAR(255),
        source VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'New',
        assigned_to UUID,
        ai_score INTEGER,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Opportunities table
    await queryRunner.query(`
      CREATE TABLE opportunities (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        deal_name VARCHAR(255) NOT NULL,
        account_id UUID NOT NULL,
        contact_id UUID,
        estimated_value DECIMAL(15, 2) NOT NULL,
        stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
        weighted_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
        expected_close_date DATE NOT NULL,
        closed_reason VARCHAR(255),
        closed_notes TEXT,
        assigned_to UUID NOT NULL,
        ai_close_probability INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Sales targets table
    await queryRunner.query(`
      CREATE TABLE sales_targets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        user_id UUID NOT NULL,
        period VARCHAR(20) NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER,
        quarter INTEGER,
        target_amount DECIMAL(15, 2) NOT NULL,
        achieved_amount DECIMAL(15, 2) NOT NULL DEFAULT 0
      )
    `);

    // Opportunity history table
    await queryRunner.query(`
      CREATE TABLE opportunity_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
        field_name VARCHAR(255) NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_by UUID NOT NULL,
        changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Lead scores table
    await queryRunner.query(`
      CREATE TABLE lead_scores (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        factors JSONB DEFAULT '[]',
        calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX idx_pipeline_stages_tenant_id ON pipeline_stages(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_pipeline_stages_tenant_sort ON pipeline_stages(tenant_id, sort_order)`);
    await queryRunner.query(`CREATE INDEX idx_leads_tenant_id ON leads(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_leads_tenant_status ON leads(tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_leads_tenant_assigned ON leads(tenant_id, assigned_to)`);
    await queryRunner.query(`CREATE INDEX idx_opportunities_tenant_id ON opportunities(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_opportunities_tenant_stage ON opportunities(tenant_id, stage_id)`);
    await queryRunner.query(`CREATE INDEX idx_opportunities_tenant_assigned ON opportunities(tenant_id, assigned_to)`);
    await queryRunner.query(`CREATE INDEX idx_sales_targets_tenant_id ON sales_targets(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_sales_targets_tenant_user ON sales_targets(tenant_id, user_id, period, year)`);
    await queryRunner.query(`CREATE INDEX idx_opportunity_history_opp ON opportunity_history(opportunity_id)`);
    await queryRunner.query(`CREATE INDEX idx_lead_scores_lead ON lead_scores(lead_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS lead_scores`);
    await queryRunner.query(`DROP TABLE IF EXISTS opportunity_history`);
    await queryRunner.query(`DROP TABLE IF EXISTS sales_targets`);
    await queryRunner.query(`DROP TABLE IF EXISTS opportunities`);
    await queryRunner.query(`DROP TABLE IF EXISTS leads`);
    await queryRunner.query(`DROP TABLE IF EXISTS pipeline_stages`);
  }
}
