"""
SF7 AgentCore Gateway — Tool Lambda Handler
Routes tool calls to backend API Gateway.
"""
import json
import os
import urllib.request
import urllib.error

API_BASE = os.environ.get("API_BASE_URL", "https://ejk5xmi2e8.execute-api.ap-southeast-1.amazonaws.com")
DEFAULT_TENANT = os.environ.get("DEFAULT_TENANT_ID", "default")


def req(method, path, body=None, tenant_id=None):
    token = os.environ.get("SERVICE_TOKEN", "")
    url = f"{API_BASE}{path}"
    hdrs = {"Content-Type": "application/json", "x-tenant-id": tenant_id or DEFAULT_TENANT, "Authorization": f"Bearer {token}"}
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}", "detail": e.read().decode()[:200] if e.fp else ""}
    except Exception as e:
        return {"error": str(e)}


def search_leads(p):
    qs = [f"limit={p.get('limit',10)}"]
    if p.get("status"): qs.append(f"status={p['status']}")
    if p.get("assignedTo"): qs.append(f"assignedTo={p['assignedTo']}")
    if p.get("search"): qs.append(f"search={p['search']}")
    return req("GET", f"/leads?{'&'.join(qs)}", tenant_id=p.get("tenantId"))

def assign_lead(p):
    return req("PATCH", f"/leads/{p['leadId']}", {"assignedTo": p["assignToUserId"], "status": "Contacted"}, p.get("tenantId"))

def create_lead(p):
    body = {k: v for k, v in p.items() if k != "tenantId" and v}
    return req("POST", "/leads", body, p.get("tenantId"))

def search_accounts(p):
    return req("GET", f"/accounts?search={p.get('search','')}&limit={p.get('limit',5)}", tenant_id=p.get("tenantId"))

def get_account_detail(p):
    return req("GET", f"/accounts/{p['accountId']}", tenant_id=p.get("tenantId"))

def search_products(p):
    qs = [f"limit={p.get('limit',10)}"]
    if p.get("search"): qs.append(f"search={p['search']}")
    if p.get("category"): qs.append(f"category={p['category']}")
    return req("GET", f"/products?{'&'.join(qs)}", tenant_id=p.get("tenantId"))

def create_quotation(p):
    body = {k: v for k, v in p.items() if k != "tenantId"}
    return req("POST", "/quotations", body, p.get("tenantId"))

def get_quotation(p):
    qid = p.get("quotationId") or p.get("quotationNumber") or ""
    return req("GET", f"/quotations/{qid}", tenant_id=p.get("tenantId"))

def approve_quotation(p):
    return req("POST", f"/quotations/{p['quotationId']}/approve", {"approvedBy": p["approvedBy"]}, p.get("tenantId"))

def search_tasks(p):
    qs = [f"limit={p.get('limit',10)}"]
    if p.get("assignedTo"): qs.append(f"assignedTo={p['assignedTo']}")
    if p.get("status"): qs.append(f"status={p['status']}")
    if p.get("overdue"): qs.append("overdue=true")
    return req("GET", f"/tasks?{'&'.join(qs)}", tenant_id=p.get("tenantId"))

def create_task(p):
    body = {k: v for k, v in p.items() if k != "tenantId"}
    return req("POST", "/tasks", body, p.get("tenantId"))

def search_opportunities(p):
    qs = [f"limit={p.get('limit',10)}"]
    if p.get("stage"): qs.append(f"stage={p['stage']}")
    if p.get("ownerId"): qs.append(f"ownerId={p['ownerId']}")
    return req("GET", f"/opportunities?{'&'.join(qs)}", tenant_id=p.get("tenantId"))

def get_kpi_summary(p):
    return req("GET", f"/dashboard?period={p.get('period','month')}", tenant_id=p.get("tenantId"))

def get_pipeline_analysis(p):
    return req("GET", "/dashboard/pipeline", tenant_id=p.get("tenantId"))

def get_revenue_data(p):
    qs = f"?year={p['year']}" if p.get("year") else ""
    return req("GET", f"/dashboard/revenue{qs}", tenant_id=p.get("tenantId"))

def get_forecast(p):
    return req("GET", "/dashboard/forecast", tenant_id=p.get("tenantId"))

def get_users(p):
    return req("GET", "/users", tenant_id=p.get("tenantId"))

def log_activity(p):
    return req("POST", "/activities", {
        "entityType": p["entityType"], "entityId": p["entityId"],
        "summary": p["summary"], "userId": p.get("userId", "system-agent"),
        "metadata": {"source": "agentcore", "automated": True}
    }, p.get("tenantId"))

def send_notification(p):
    return req("POST", "/notifications", {
        "userId": p["userId"], "channel": p.get("channel", "in_app"),
        "type": p["type"], "title": p["title"], "body": p["body"],
    }, p.get("tenantId"))


TOOLS = {
    "search_leads": search_leads, "assign_lead": assign_lead, "create_lead": create_lead,
    "search_accounts": search_accounts, "get_account_detail": get_account_detail,
    "search_products": search_products, "create_quotation": create_quotation,
    "get_quotation": get_quotation, "approve_quotation": approve_quotation,
    "search_tasks": search_tasks, "create_task": create_task,
    "search_opportunities": search_opportunities, "get_kpi_summary": get_kpi_summary,
    "get_pipeline_analysis": get_pipeline_analysis, "get_revenue_data": get_revenue_data,
    "get_forecast": get_forecast, "get_users": get_users,
    "log_activity": log_activity, "send_notification": send_notification,
}


def handler(event, context):
    tool_name = event.get("name", "")
    arguments = event.get("arguments", event.get("input", {}))
    if isinstance(arguments, str):
        try: arguments = json.loads(arguments)
        except: arguments = {"query": arguments}

    if tool_name not in TOOLS:
        return {"statusCode": 400, "body": json.dumps({"error": f"Unknown tool: {tool_name}", "available": list(TOOLS.keys())})}

    try:
        result = TOOLS[tool_name](arguments)
        return {"statusCode": 200, "body": json.dumps(result, ensure_ascii=False, default=str)}
    except Exception as e:
        return {"statusCode": 500, "body": json.dumps({"error": str(e), "tool": tool_name})}
