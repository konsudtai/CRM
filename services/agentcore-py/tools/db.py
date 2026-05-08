"""
PostgreSQL connection pool for CRM tools.
Uses Row-Level Security (RLS) via tenant_id.
"""
import os
from typing import Any, List
from psycopg_pool import ConnectionPool

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        conninfo = (
            f"host={os.environ.get('DB_HOST')} "
            f"port={os.environ.get('DB_PORT', '5432')} "
            f"user={os.environ.get('DB_USER', 'salesfast7')} "
            f"password={os.environ.get('DB_PASS')} "
            f"dbname={os.environ.get('DB_NAME', 'salesfast7')} "
            f"sslmode={'require' if os.environ.get('DB_SSL', 'true') != 'false' else 'disable'}"
        )
        _pool = ConnectionPool(
            conninfo=conninfo,
            min_size=1,
            max_size=5,
            timeout=10,
        )
    return _pool


def query(tenant_id: str, sql: str, params: tuple = ()) -> List[dict]:
    """Run query with RLS tenant context."""
    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT set_config('app.current_tenant', %s, true)", (tenant_id,))
            cur.execute(sql, params)
            if cur.description is None:
                return []
            cols = [d.name for d in cur.description]
            rows = cur.fetchall()
            return [dict(zip(cols, row)) for row in rows]
