import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuotationTables1700000000001 implements MigrationInterface {
  name = 'CreateQuotationTables1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Products table
    await queryRunner.query(`
      CREATE TABLE products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(100) NOT NULL,
        description TEXT,
        unit_price DECIMAL(12, 2) NOT NULL,
        unit_of_measure VARCHAR(50) NOT NULL,
        wht_rate DECIMAL(5, 2),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Quotations table
    await queryRunner.query(`
      CREATE TABLE quotations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        quotation_number VARCHAR(50) NOT NULL,
        account_id UUID NOT NULL,
        contact_id UUID,
        opportunity_id UUID,
        subtotal DECIMAL(14, 2) NOT NULL DEFAULT 0,
        total_discount DECIMAL(14, 2) NOT NULL DEFAULT 0,
        vat_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
        wht_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
        grand_total DECIMAL(14, 2) NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'draft',
        pdf_url VARCHAR(1024),
        valid_until DATE,
        created_by UUID NOT NULL,
        approved_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Quotation line items table
    await queryRunner.query(`
      CREATE TABLE quotation_line_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
        product_id UUID NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        sku VARCHAR(100) NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(12, 2) NOT NULL,
        discount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        discount_type VARCHAR(20) NOT NULL DEFAULT 'fixed',
        wht_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
        line_total DECIMAL(14, 2) NOT NULL DEFAULT 0
      )
    `);

    // Quotation sequences table (for sequential numbering per tenant)
    await queryRunner.query(`
      CREATE TABLE quotation_sequences (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        prefix VARCHAR(20) NOT NULL,
        current_value INTEGER NOT NULL DEFAULT 0,
        year INTEGER NOT NULL,
        UNIQUE(tenant_id, prefix, year)
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX idx_products_tenant_id ON products(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_products_tenant_sku ON products(tenant_id, sku)`);
    await queryRunner.query(`CREATE INDEX idx_quotations_tenant_id ON quotations(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_quotations_tenant_account ON quotations(tenant_id, account_id)`);
    await queryRunner.query(`CREATE INDEX idx_quotations_tenant_number ON quotations(tenant_id, quotation_number)`);
    await queryRunner.query(`CREATE INDEX idx_quotation_line_items_quotation ON quotation_line_items(quotation_id)`);
    await queryRunner.query(`CREATE INDEX idx_quotation_sequences_tenant ON quotation_sequences(tenant_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS quotation_line_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS quotation_sequences`);
    await queryRunner.query(`DROP TABLE IF EXISTS quotations`);
    await queryRunner.query(`DROP TABLE IF EXISTS products`);
  }
}
