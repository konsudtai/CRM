"""
CRM Tools — MCP-style tools exposing PostgreSQL CRM database to agents.

Each tool is a @tool-decorated function that agents can call.
All queries use RLS via tenant_id parameter.
"""
import json
from typing import Optional
from strands import tool
from .db import query

# Tenant ID context — set per request by FastAPI middleware
_current_tenant: dict = {'id': '00000000-0000-0000-0000-000000000001'}


def set_tenant(tenant_id: str) -> None:
    """Called by FastAPI before invoking agent."""
    _current_tenant['id'] = tenant_id


def _tid() -> str:
    return _current_tenant['id']


# ══════════════════════════════════════════════════════════════
# LEADS
# ══════════════════════════════════════════════════════════════

@tool
def get_leads(status: Optional[str] = None, search: Optional[str] = None, limit: int = 10) -> str:
    """ค้นหา Leads — filter ตาม status, keyword. ใช้เมื่อต้องการดูรายการ Lead.

    Args:
        status: New, Contacted, Qualified, Proposal, Negotiation, Won, Lost
        search: ค้นหาด้วยชื่อ/บริษัท/email
        limit: จำนวนสูงสุด (default 10, max 20)
    """
    where = "tenant_id = %s"
    params: list = [_tid()]
    if status:
        where += " AND status = %s"
        params.append(status)
    if search:
        where += " AND (name ILIKE %s OR company_name ILIKE %s)"
        params.append(f'%{search}%')
        params.append(f'%{search}%')
    params.append(min(limit, 20))
    sql = f"""SELECT id, name, company_name, status, source, assigned_to,
              (metadata->>'estimatedValue') as value, (metadata->>'projectName') as project
              FROM leads WHERE {where} ORDER BY created_at DESC LIMIT %s"""
    rows = query(_tid(), sql, tuple(params))
    return json.dumps(rows, default=str, ensure_ascii=False)


@tool
def get_lead_detail(lead_id: Optional[str] = None, search: Optional[str] = None) -> str:
    """ดูรายละเอียด Lead พร้อม Sales Rep ที่ดูแล (ชื่อ, เบอร์, email). ใช้เมื่อลูกค้าถามว่าใครดูแลอยู่.

    Args:
        lead_id: Lead ID (UUID)
        search: ค้นหาด้วยชื่อ/บริษัท/เบอร์
    """
    if lead_id:
        sql = """SELECT l.*, u.first_name as rep_first, u.last_name as rep_last,
                 u.email as rep_email, u.phone as rep_phone
                 FROM leads l LEFT JOIN users u ON u.id = l.assigned_to
                 WHERE l.id = %s AND l.tenant_id = %s"""
        rows = query(_tid(), sql, (lead_id, _tid()))
    elif search:
        sql = """SELECT l.*, u.first_name as rep_first, u.last_name as rep_last,
                 u.email as rep_email, u.phone as rep_phone
                 FROM leads l LEFT JOIN users u ON u.id = l.assigned_to
                 WHERE l.tenant_id = %s AND (l.name ILIKE %s OR l.company_name ILIKE %s OR l.phone ILIKE %s)
                 LIMIT 5"""
        s = f'%{search}%'
        rows = query(_tid(), sql, (_tid(), s, s, s))
    else:
        return "Please provide lead_id or search"
    return json.dumps(rows, default=str, ensure_ascii=False)


@tool
def create_lead(name: str, company_name: Optional[str] = None, email: Optional[str] = None,
                phone: Optional[str] = None, source: str = 'ai_chat',
                notes: Optional[str] = None, estimated_value: Optional[float] = None) -> str:
    """สร้าง Lead ใหม่ในระบบ CRM.

    Args:
        name: ชื่อผู้ติดต่อ (required)
        company_name: ชื่อบริษัท
        email: email
        phone: เบอร์โทร
        source: แหล่งที่มา (default: ai_chat)
        notes: รายละเอียดเพิ่มเติม
        estimated_value: งบประมาณ
    """
    meta = {}
    if notes:
        meta['notes'] = notes
    if estimated_value:
        meta['estimatedValue'] = estimated_value
    sql = """INSERT INTO leads (tenant_id, name, company_name, email, phone, source, status, metadata)
             VALUES (%s, %s, %s, %s, %s, %s, 'New', %s) RETURNING id, name, status"""
    rows = query(_tid(), sql, (_tid(), name, company_name, email, phone, source, json.dumps(meta)))
    return f"Lead created: {json.dumps(rows[0], default=str, ensure_ascii=False)}"


@tool
def update_lead(lead_id: str, status: Optional[str] = None, assigned_to: Optional[str] = None) -> str:
    """อัพเดท Lead — เปลี่ยน status หรือ assign Sales Rep.

    Args:
        lead_id: Lead ID
        status: New, Contacted, Qualified, Proposal, Negotiation, Won, Lost
        assigned_to: User ID ของ Sales Rep
    """
    sets = []
    vals = []
    if status:
        sets.append("status = %s")
        vals.append(status)
    if assigned_to:
        sets.append("assigned_to = %s")
        vals.append(assigned_to)
    if not sets:
        return "No fields to update"
    sets.append("updated_at = NOW()")
    vals.append(lead_id)
    sql = f"UPDATE leads SET {', '.join(sets)} WHERE id = %s RETURNING id, name, status"
    rows = query(_tid(), sql, tuple(vals))
    return f"Updated: {json.dumps(rows[0] if rows else {}, default=str, ensure_ascii=False)}"


# ══════════════════════════════════════════════════════════════
# ACCOUNTS
# ══════════════════════════════════════════════════════════════

@tool
def get_accounts(search: Optional[str] = None, limit: int = 10) -> str:
    """ค้นหาลูกค้า (Accounts) — ชื่อ, สถานะ, tier.

    Args:
        search: ค้นหาด้วยชื่อบริษัท/เบอร์
        limit: จำนวนสูงสุด
    """
    where = "tenant_id = %s AND deleted_at IS NULL"
    params: list = [_tid()]
    if search:
        where += " AND (company_name ILIKE %s OR phone ILIKE %s)"
        s = f'%{search}%'
        params.extend([s, s])
    params.append(min(limit, 20))
    sql = f"""SELECT id, company_name, account_status, account_tier, total_revenue, industry
              FROM accounts WHERE {where} ORDER BY total_revenue DESC NULLS LAST LIMIT %s"""
    rows = query(_tid(), sql, tuple(params))
    return json.dumps(rows, default=str, ensure_ascii=False)


@tool
def get_account_detail(account_id: str) -> str:
    """ดูรายละเอียดลูกค้า + contacts + owner."""
    acc = query(_tid(), """
        SELECT a.*, u.first_name as owner_first, u.last_name as owner_last, u.phone as owner_phone
        FROM accounts a LEFT JOIN users u ON u.id = a.account_owner
        WHERE a.id = %s""", (account_id,))
    contacts = query(_tid(), """
        SELECT first_name, last_name, title, phone, email
        FROM contacts WHERE account_id = %s AND is_active = true""", (account_id,))
    return json.dumps({'account': acc[0] if acc else None, 'contacts': contacts}, default=str, ensure_ascii=False)


# ══════════════════════════════════════════════════════════════
# USERS
# ══════════════════════════════════════════════════════════════

@tool
def get_users() -> str:
    """ดูรายชื่อ Sales Reps ทั้งหมด — ชื่อ, email, เบอร์, role."""
    sql = """SELECT u.id, u.first_name || ' ' || u.last_name as name, u.email, u.phone,
             (SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id LIMIT 1) as role
             FROM users u WHERE u.tenant_id = %s AND u.is_active = true ORDER BY u.first_name"""
    rows = query(_tid(), sql, (_tid(),))
    return json.dumps(rows, default=str, ensure_ascii=False)


# ══════════════════════════════════════════════════════════════
# TASKS
# ══════════════════════════════════════════════════════════════

@tool
def get_tasks(status: Optional[str] = None, assigned_to: Optional[str] = None,
              overdue_only: bool = False, limit: int = 10) -> str:
    """ดู Tasks — filter ตาม status, assigned_to, overdue.

    Args:
        status: Open, In Progress, Completed
        assigned_to: User ID
        overdue_only: เฉพาะ task ที่เกินกำหนด
    """
    where = "tenant_id = %s"
    params: list = [_tid()]
    if status:
        where += " AND status = %s"
        params.append(status)
    if assigned_to:
        where += " AND assigned_to = %s"
        params.append(assigned_to)
    if overdue_only:
        where += " AND due_date < NOW() AND status != 'Completed'"
    params.append(min(limit, 20))
    sql = f"""SELECT id, title, status, priority, due_date, assigned_to
              FROM tasks WHERE {where} ORDER BY due_date ASC LIMIT %s"""
    rows = query(_tid(), sql, tuple(params))
    return json.dumps(rows, default=str, ensure_ascii=False)


@tool
def create_task(title: str, assigned_to: str, due_date: str, priority: str = 'Medium') -> str:
    """สร้าง Task ใหม่.

    Args:
        title: ชื่อ task
        assigned_to: User ID
        due_date: YYYY-MM-DD
        priority: High, Medium, Low
    """
    sql = """INSERT INTO tasks (tenant_id, title, due_date, priority, status, assigned_to)
             VALUES (%s, %s, %s, %s, 'Open', %s) RETURNING id, title, status, due_date"""
    rows = query(_tid(), sql, (_tid(), title, due_date, priority, assigned_to))
    return f"Task created: {json.dumps(rows[0], default=str, ensure_ascii=False)}"


# ══════════════════════════════════════════════════════════════
# PRODUCTS & QUOTATIONS
# ══════════════════════════════════════════════════════════════

@tool
def get_products(search: Optional[str] = None) -> str:
    """ค้นหาสินค้า/บริการในแคตตาล็อก."""
    where = "tenant_id = %s AND is_active = true"
    params: list = [_tid()]
    if search:
        where += " AND (name ILIKE %s OR sku ILIKE %s)"
        s = f'%{search}%'
        params.extend([s, s])
    sql = f"SELECT id, name, sku, description, unit_price FROM products WHERE {where} ORDER BY name LIMIT 10"
    rows = query(_tid(), sql, tuple(params))
    return json.dumps(rows, default=str, ensure_ascii=False)


@tool
def get_quotations(status: Optional[str] = None) -> str:
    """ดู Quotations — filter ตาม status.

    Args:
        status: draft, pending_approval, sent, accepted, rejected
    """
    where = "q.tenant_id = %s"
    params: list = [_tid()]
    if status:
        where += " AND q.status = %s"
        params.append(status)
    sql = f"""SELECT q.id, q.quotation_number, q.status, q.grand_total, a.company_name
              FROM quotations q LEFT JOIN accounts a ON a.id = q.account_id
              WHERE {where} ORDER BY q.created_at DESC LIMIT 10"""
    rows = query(_tid(), sql, tuple(params))
    return json.dumps(rows, default=str, ensure_ascii=False)


# ══════════════════════════════════════════════════════════════
# PIPELINE & KPI
# ══════════════════════════════════════════════════════════════

@tool
def get_pipeline_summary() -> str:
    """สรุป Pipeline — จำนวน leads แต่ละ stage + มูลค่ารวม."""
    sql = """SELECT status, count(*) as count,
             COALESCE(sum((metadata->>'estimatedValue')::numeric), 0) as total_value
             FROM leads WHERE tenant_id = %s GROUP BY status"""
    rows = query(_tid(), sql, (_tid(),))
    return json.dumps(rows, default=str, ensure_ascii=False)


@tool
def get_kpi_summary() -> str:
    """สรุป KPI ทั้งหมด — leads, accounts, tasks, quotations."""
    leads = query(_tid(), "SELECT count(*) as total, count(*) FILTER (WHERE status='Won') as won FROM leads WHERE tenant_id = %s", (_tid(),))
    accounts = query(_tid(), "SELECT count(*) as total FROM accounts WHERE tenant_id = %s AND deleted_at IS NULL AND account_status='active'", (_tid(),))
    tasks = query(_tid(), "SELECT count(*) as total, count(*) FILTER (WHERE status!='Completed' AND due_date<NOW()) as overdue FROM tasks WHERE tenant_id = %s", (_tid(),))
    qts = query(_tid(), "SELECT count(*) as total, COALESCE(sum(grand_total),0) as value FROM quotations WHERE tenant_id = %s", (_tid(),))
    return json.dumps({
        'leads': leads[0] if leads else {},
        'active_accounts': accounts[0]['total'] if accounts else 0,
        'tasks': tasks[0] if tasks else {},
        'quotations': qts[0] if qts else {},
    }, default=str, ensure_ascii=False)


@tool
def get_sales_rep_performance() -> str:
    """ดูผลงาน Sales Rep แต่ละคน — leads, won, tasks."""
    sql = """SELECT u.id, u.first_name || ' ' || u.last_name as name,
             (SELECT count(*) FROM leads l WHERE l.assigned_to = u.id) as total_leads,
             (SELECT count(*) FROM leads l WHERE l.assigned_to = u.id AND l.status='Won') as won_leads,
             (SELECT count(*) FROM tasks t WHERE t.assigned_to = u.id AND t.status!='Completed') as open_tasks
             FROM users u WHERE u.tenant_id = %s AND u.is_active = true ORDER BY total_leads DESC"""
    rows = query(_tid(), sql, (_tid(),))
    return json.dumps(rows, default=str, ensure_ascii=False)


# ══════════════════════════════════════════════════════════════
# Tool collections
# ══════════════════════════════════════════════════════════════

ALL_CRM_TOOLS = [
    get_leads, get_lead_detail, create_lead, update_lead,
    get_accounts, get_account_detail, get_users,
    get_tasks, create_task,
    get_products, get_quotations,
    get_pipeline_summary, get_kpi_summary, get_sales_rep_performance,
]

ADMIN_TOOLS = [get_products, create_lead]

SALES_TOOLS = ALL_CRM_TOOLS  # full access

ANALYTICS_TOOLS = [
    get_pipeline_summary, get_kpi_summary, get_sales_rep_performance,
    get_leads, get_accounts,
]
