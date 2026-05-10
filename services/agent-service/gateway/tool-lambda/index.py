"""
SF7 AgentCore Gateway — Tool Lambda Handler
This Lambda is called by AgentCore Gateway as an MCP tool target.
It routes tool calls to the appropriate backend service (CRM, Sales, Quotation, etc.)
"""
import json
import os
import urllib.request
import urllib.error

# Internal API base URL (API Gateway)
API_BASE = os.environ.get("API_BASE_URL", "")
INTERNAL_TOKEN = os.environ.get("INTERNAL_SERVICE_TOKEN", "")
DEFAULT_TENANT = os.environ.get("DEFAULT_TENANT_ID", "default")


def make_request(method, url, body=None, headers=None):
    """Make HTTP request to internal APIs."""
    hdrs = {
        "Content-Type": "application/json",
        "x-tenant-id": DEFAULT_TENANT,
    }
    if INTERNAL_TOKEN:
        hdrs["Authorization"] = f"Bearer {INTERNAL_TOKEN}"
    if headers:
        hdrs.update(headers)

    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else str(e)
        return {"error": f"HTTP {e.code}", "detail": error_body}
    except Exception as e:
        return {"error": str(e)}


def api_get(path, tenant_id=None):
    hdrs = {}
    if tenant_id:
        hdrs["x-tenant-id"] = tenant_id
    url = f"{API_BASE}{path}"
    return make_request("GET", url, headers=hdrs)


def api_post(path, body, tenant_id=None):
    hdrs = {}
    if tenant_id:
        hdrs["x-tenant-id"] = tenant_id
    url = f"{API_BASE}{path}"
    return make_request("POST", url, body=body, headers=hdrs)


def api_patch(path, body, tenant_id=None):
    hdrs = {}
    if tenant_id:
        hdrs["x-tenant-id"] = tenant_id
    url = f"{API_BASE}{path}"
    return make_request("PATCH", url, body=body, headers=hdrs)


# ═══════════════════════════════════════════════════════════
# Tool Implementations
# ═══════════════════════════════════════════════════════════

def search_leads(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    qs = []
    if params.get("status"):
        qs.append(f"status={params['status']}")
    if params.get("assignedTo"):
        qs.append(f"assignedTo={params['assignedTo']}")
    if params.get("search"):
        qs.append(f"search={params['search']}")
    qs.append(f"limit={params.get('limit', 10)}")
    return api_get(f"/sales/leads?{'&'.join(qs)}", tid)


def assign_lead(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    lead_id = params["leadId"]
    return api_patch(f"/sales/leads/{lead_id}", {
        "assignedTo": params["assignToUserId"],
        "status": "Contacted"
    }, tid)


def create_lead(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    body = {k: v for k, v in params.items() if k != "tenantId" and v}
    return api_post("/sales/leads", body, tid)


def search_accounts(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    search = params.get("search", "")
    limit = params.get("limit", 5)
    return api_get(f"/crm/accounts?search={search}&limit={limit}", tid)


def get_account_detail(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    return api_get(f"/crm/accounts/{params['accountId']}", tid)


def search_products(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    qs = []
    if params.get("search"):
        qs.append(f"search={params['search']}")
    if params.get("category"):
        qs.append(f"category={params['category']}")
    qs.append(f"limit={params.get('limit', 10)}")
    return api_get(f"/quotation/products?{'&'.join(qs)}", tid)


def create_quotation(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    body = {k: v for k, v in params.items() if k != "tenantId"}
    return api_post("/quotation/quotations", body, tid)


def get_quotation(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    qid = params.get("quotationId") or params.get("quotationNumber")
    return api_get(f"/quotation/quotations/{qid}", tid)


def approve_quotation(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    return api_post(f"/quotation/quotations/{params['quotationId']}/approve", {
        "approvedBy": params["approvedBy"]
    }, tid)


def search_tasks(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    qs = []
    if params.get("assignedTo"):
        qs.append(f"assignedTo={params['assignedTo']}")
    if params.get("status"):
        qs.append(f"status={params['status']}")
    if params.get("overdue"):
        qs.append("overdue=true")
    qs.append(f"limit={params.get('limit', 10)}")
    return api_get(f"/crm/tasks?{'&'.join(qs)}", tid)


def create_task(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    body = {k: v for k, v in params.items() if k != "tenantId"}
    return api_post("/crm/tasks", body, tid)


def search_opportunities(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    qs = []
    if params.get("stage"):
        qs.append(f"stage={params['stage']}")
    if params.get("ownerId"):
        qs.append(f"ownerId={params['ownerId']}")
    qs.append(f"limit={params.get('limit', 10)}")
    return api_get(f"/sales/opportunities?{'&'.join(qs)}", tid)


def get_kpi_summary(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    period = params.get("period", "month")
    return api_get(f"/sales/dashboard/kpi?period={period}", tid)


def get_pipeline_analysis(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    return api_get("/sales/dashboard/pipeline-analysis", tid)


def get_revenue_data(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    year = params.get("year", "")
    qs = f"?year={year}" if year else ""
    return api_get(f"/sales/dashboard/revenue{qs}", tid)


def get_forecast(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    return api_get("/sales/dashboard/forecast", tid)


def get_users(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    return api_get("/auth/users", tid)


def log_activity(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    body = {
        "entityType": params["entityType"],
        "entityId": params["entityId"],
        "summary": params["summary"],
        "userId": params.get("userId", "system-agent"),
        "metadata": {**(params.get("metadata") or {}), "source": "agentcore", "automated": True},
    }
    return api_post("/crm/activities", body, tid)


def send_notification(params):
    tid = params.get("tenantId", DEFAULT_TENANT)
    body = {
        "userId": params["userId"],
        "channel": params.get("channel", "in_app"),
        "type": params["type"],
        "title": params["title"],
        "body": params["body"],
        "metadata": {**(params.get("metadata") or {}), "source": "agentcore"},
    }
    return api_post("/notification/notifications", body, tid)


# ═══════════════════════════════════════════════════════════
# Tool Registry
# ═══════════════════════════════════════════════════════════

TOOLS = {
    "search_leads": search_leads,
    "assign_lead": assign_lead,
    "create_lead": create_lead,
    "search_accounts": search_accounts,
    "get_account_detail": get_account_detail,
    "search_products": search_products,
    "create_quotation": create_quotation,
    "get_quotation": get_quotation,
    "approve_quotation": approve_quotation,
    "search_tasks": search_tasks,
    "create_task": create_task,
    "search_opportunities": search_opportunities,
    "get_kpi_summary": get_kpi_summary,
    "get_pipeline_analysis": get_pipeline_analysis,
    "get_revenue_data": get_revenue_data,
    "get_forecast": get_forecast,
    "get_users": get_users,
    "log_activity": log_activity,
    "send_notification": send_notification,
}


def handler(event, context):
    """
    Lambda handler for AgentCore Gateway tool invocations.
    The Gateway sends: { "name": "tool_name", "arguments": {...} }
    """
    # Gateway sends tool call as the event
    tool_name = event.get("name", "")
    arguments = event.get("arguments", event.get("input", {}))

    # If arguments is a string, parse it
    if isinstance(arguments, str):
        try:
            arguments = json.loads(arguments)
        except:
            arguments = {"query": arguments}

    if tool_name not in TOOLS:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": f"Unknown tool: {tool_name}", "available": list(TOOLS.keys())})
        }

    try:
        result = TOOLS[tool_name](arguments)
        return {
            "statusCode": 200,
            "body": json.dumps(result, ensure_ascii=False, default=str)
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e), "tool": tool_name})
        }
