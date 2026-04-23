import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the tasks table with RLS enabled for tenant isolation.
 */
export class CreateTasksTable1700000000004 implements MigrationInterface {
  name = 'CreateTasksTable1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        due_date DATE NOT NULL,
        priority VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Open',
        assigned_to UUID,
        account_id UUID,
        contact_id UUID,
        opportunity_id UUID,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_tasks_tenant_id ON tasks(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_tasks_tenant_due_date ON tasks(tenant_id, due_date)`);
    await queryRunner.query(`CREATE INDEX idx_tasks_tenant_status ON tasks(tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_tasks_tenant_assigned ON tasks(tenant_id, assigned_to)`);

    await queryRunner.query(`ALTER TABLE tasks ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE tasks FORCE ROW LEVEL SECURITY`);

    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON tasks
        USING (tenant_id = current_setting('app.current_tenant')::uuid)
    `);

    await queryRunner.query(`
      CREATE POLICY tenant_isolation_insert ON tasks
        FOR INSERT
        WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON tasks`);
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_insert ON tasks`);
    await queryRunner.query(`ALTER TABLE tasks DISABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP TABLE IF EXISTS tasks`);
  }
}
