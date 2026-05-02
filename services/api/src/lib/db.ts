/**
 * PostgreSQL connection pool — shared across all routes.
 * Uses RLS: every query runs with tenant_id set via set_config().
 */
import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || process.env.DB_USERNAME || 'salesfast7',
      password: process.env.DB_PASS || process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'salesfast7',
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

/**
 * Run a query with RLS tenant context.
 */
export async function query(tenantId: string, sql: string, params: any[] = []) {
  const client = await getPool().connect();
  try {
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * Run a query WITHOUT RLS (for login, tenant lookup).
 */
export async function queryNoRLS(sql: string, params: any[] = []) {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * Run multiple queries in a transaction with RLS.
 */
export async function transaction(tenantId: string, fn: (client: PoolClient) => Promise<any>) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
