"""
น้องขายไว (Sales Agent) — Strands SDK
- Tools: AgentCore Gateway (MCP)
- Memory: AgentCore Memory (sf7_sales_memory)
- A2A: ask_analytics → call น้องวิ runtime
"""
import os
import json
import sys

from strands import Agent, tool
from strands.models import BedrockModel

import boto3
import urllib.request
import urllib.error

# ── Configuration ──
REGION = os.environ.get("AWS_REGION", "ap-southeast-1")
MODEL_ID = os.environ.get("MODEL_ID", "global.anthropic.claude-sonnet-4-6")
MEMORY_ID = os.environ.get("MEMORY_ID", "sf7_agents_memory-Ye8E3AGtiH")
GATEWAY_URL = os.environ.get("GATEWAY_URL", "https://sf7-crm-gateway-zd795zpjtz.gateway.bedrock-agentcore.ap-southeast-1.amazonaws.com/mcp")  # AgentCore Gateway MCP endpoint
GATEWAY_TOKEN = os.environ.get("GATEWAY_TOKEN", "")
ANALYTICS_RUNTIME_ARN = os.environ.get("ANALYTICS_RUNTIME_ARN", "")
TOOL_PREFIX = os.environ.get("TOOL_PREFIX", "sf7-crm-tools___")

# AWS clients
_bedrock_agentcore = boto3.client("bedrock-agentcore", region_name=REGION)
_bedrock_agentcore_control = boto3.client("bedrock-agentcore-control", region_name=REGION)


# ──────────────────────────────────────────────────────────────
# Memory helpers
# ──────────────────────────────────────────────────────────────

def memory_save_event(session_id: str, actor_id: str, role: str, text: str):
    """Save conversation event to AgentCore Memory."""
    try:
        from datetime import datetime
        _bedrock_agentcore.create_event(
            memoryId=MEMORY_ID,
            actorId=actor_id,
            sessionId=session_id,
            eventTimestamp=datetime.utcnow(),
            payload=[
                {
                    "conversational": {
                        "role": role.upper() if role.upper() in ("USER", "ASSISTANT", "TOOL", "OTHER") else "OTHER",
                        "content": {"text": text},
                    }
                }
            ],
        )
    except Exception as e:
        print(f"[memory] save_event error: {e}", flush=True)


def memory_load_history(session_id: str, actor_id: str, max_results: int = 10):
    """Load recent conversation events from AgentCore Memory."""
    try:
        resp = _bedrock_agentcore.list_events(
            memoryId=MEMORY_ID,
            actorId=actor_id,
            sessionId=session_id,
            maxResults=max_results,
            includePayloads=True,
        )
        events = resp.get("events", [])
        # Sort oldest→newest
        events.sort(key=lambda e: e.get("eventTimestamp"))
        history = []
        for ev in events:
            for item in ev.get("payload", []):
                conv = item.get("conversational", {})
                if conv:
                    role = conv.get("role", "USER").lower()
                    text = conv.get("content", {}).get("text", "")
                    if text:
                        history.append({"role": role, "content": text})
        return history
    except Exception as e:
        print(f"[memory] load_history error: {e}", flush=True)
        return []


def memory_retrieve_context(actor_id: str, query: str, max_results: int = 5):
    """Semantic retrieval from long-term memory."""
    try:
        # Try preferences namespace
        resp = _bedrock_agentcore.retrieve_memory_records(
            memoryId=MEMORY_ID,
            namespace=f"/sales/{actor_id}/context",
            searchCriteria={"searchQuery": query, "topK": max_results},
        )
        records = resp.get("memoryRecordSummaries", [])
        return [r.get("content", {}).get("text", "") for r in records]
    except Exception as e:
        print(f"[memory] retrieve error: {e}", flush=True)
        return []


# ──────────────────────────────────────────────────────────────
# Gateway MCP tool wrappers — generic call
# ──────────────────────────────────────────────────────────────

def _call_gateway(tool_name: str, arguments: dict) -> str:
    """Call a Gateway MCP tool and return text response."""
    if not GATEWAY_URL:
        return "Gateway URL not configured"

    payload = {
        "jsonrpc": "2.0",
        "id": "1",
        "method": "tools/call",
        "params": {"name": TOOL_PREFIX + tool_name, "arguments": arguments},
    }
    headers = {"Content-Type": "application/json"}
    if GATEWAY_TOKEN:
        headers["Authorization"] = f"Bearer {GATEWAY_TOKEN}"

    try:
        req = urllib.request.Request(
            GATEWAY_URL,
            data=json.dumps(payload).encode(),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=25) as r:
            res = json.loads(r.read().decode())
            content = res.get("result", {}).get("content", [{}])
            txt = content[0].get("text", "{}") if content else "{}"
            # Wrap result in a description prefix so Strands doesn't try to parse it as JSON content block
            return f"Result: {txt}"
    except urllib.error.HTTPError as e:
        return f"Gateway HTTP {e.code}: {e.read().decode()[:300]}"
    except Exception as e:
        return f"Gateway error: {e}"


# ──────────────────────────────────────────────────────────────
# Tools (Strands @tool decorators)
# ──────────────────────────────────────────────────────────────

@tool
def search_leads(tenant_id: str = "default", status: str = "", search: str = "", limit: int = 10) -> str:
    """ค้นหา Lead — กรองด้วย status (New/Contacted/Qualified/Proposal/Negotiation/Won/Lost) หรือ search keyword"""
    args = {"tenantId": tenant_id, "limit": limit}
    if status:
        args["status"] = status
    if search:
        args["search"] = search
    return _call_gateway("search_leads", args)


@tool
def assign_lead(tenant_id: str, lead_id: str, assign_to_user_id: str, assign_to_name: str) -> str:
    """มอบหมาย Lead ให้ Sales Rep"""
    return _call_gateway(
        "assign_lead",
        {
            "tenantId": tenant_id,
            "leadId": lead_id,
            "assignToUserId": assign_to_user_id,
            "assignToName": assign_to_name,
        },
    )


@tool
def create_lead(tenant_id: str, name: str, company_name: str = "", phone: str = "", email: str = "", source: str = "manual", notes: str = "") -> str:
    """สร้าง Lead ใหม่"""
    return _call_gateway(
        "create_lead",
        {
            "tenantId": tenant_id,
            "name": name,
            "companyName": company_name,
            "phone": phone,
            "email": email,
            "source": source,
            "notes": notes,
        },
    )


@tool
def search_accounts(tenant_id: str = "default", search: str = "", limit: int = 10) -> str:
    """ค้นหาลูกค้า (Accounts) ด้วยชื่อบริษัท เบอร์ Tax ID"""
    return _call_gateway("search_accounts", {"tenantId": tenant_id, "search": search, "limit": limit})


@tool
def get_account_detail(tenant_id: str, account_id: str) -> str:
    """ดูรายละเอียด Account แบบเต็ม (contacts, deals, quotations, tasks)"""
    return _call_gateway("get_account_detail", {"tenantId": tenant_id, "accountId": account_id})


@tool
def search_products(tenant_id: str = "default", search: str = "") -> str:
    """ค้นหาสินค้า/บริการ"""
    return _call_gateway("search_products", {"tenantId": tenant_id, "search": search})


@tool
def create_quotation(tenant_id: str, account_id: str, line_items: list, notes: str = "") -> str:
    """สร้างใบเสนอราคา (Draft) — line_items=[{productId,quantity,unitPrice,...}]"""
    return _call_gateway(
        "create_quotation",
        {"tenantId": tenant_id, "accountId": account_id, "lineItems": line_items, "notes": notes},
    )


@tool
def approve_quotation(tenant_id: str, quotation_id: str, approved_by: str) -> str:
    """อนุมัติใบเสนอราคา (Manager only)"""
    return _call_gateway(
        "approve_quotation",
        {"tenantId": tenant_id, "quotationId": quotation_id, "approvedBy": approved_by},
    )


@tool
def search_tasks(tenant_id: str = "default", assigned_to: str = "", status: str = "", overdue: bool = False) -> str:
    """ค้นหา Task"""
    args = {"tenantId": tenant_id}
    if assigned_to:
        args["assignedTo"] = assigned_to
    if status:
        args["status"] = status
    if overdue:
        args["overdue"] = overdue
    return _call_gateway("search_tasks", args)


@tool
def create_task(tenant_id: str, title: str, assigned_to: str, due_date: str, priority: str = "Medium") -> str:
    """สร้าง Task ใหม่ (due_date format: YYYY-MM-DD)"""
    return _call_gateway(
        "create_task",
        {
            "tenantId": tenant_id,
            "title": title,
            "assignedTo": assigned_to,
            "dueDate": due_date,
            "priority": priority,
        },
    )


@tool
def search_opportunities(tenant_id: str = "default", stage: str = "") -> str:
    """ค้นหา Deal/Opportunity"""
    args = {"tenantId": tenant_id}
    if stage:
        args["stage"] = stage
    return _call_gateway("search_opportunities", args)


@tool
def get_users(tenant_id: str = "default") -> str:
    """ดึงรายชื่อ Sales Rep / Users ในระบบ"""
    return _call_gateway("get_users", {"tenantId": tenant_id})


@tool
def log_activity(tenant_id: str, entity_type: str, entity_id: str, summary: str) -> str:
    """บันทึก Activity log"""
    return _call_gateway(
        "log_activity",
        {"tenantId": tenant_id, "entityType": entity_type, "entityId": entity_id, "summary": summary},
    )


@tool
def send_notification(tenant_id: str, user_id: str, type: str, title: str, body: str) -> str:
    """ส่ง notification ให้ user"""
    return _call_gateway(
        "send_notification",
        {"tenantId": tenant_id, "userId": user_id, "type": type, "title": title, "body": body},
    )


@tool
def ask_analytics(question: str) -> str:
    """ถามน้องวิ (Analytics Specialist) เพื่อวิเคราะห์ KPI, pipeline, forecast — A2A protocol"""
    if not ANALYTICS_RUNTIME_ARN:
        return json.dumps({"error": "Analytics runtime not configured"})
    try:
        resp = _bedrock_agentcore.invoke_agent_runtime(
            agentRuntimeArn=ANALYTICS_RUNTIME_ARN,
            payload=json.dumps({"message": question, "sessionId": "a2a-from-sales"}).encode(),
            contentType="application/json",
            accept="application/json",
        )
        data = json.loads(resp["response"].read().decode())
        return data.get("reply", str(data))
    except Exception as e:
        return json.dumps({"error": f"A2A failed: {e}"})


# ──────────────────────────────────────────────────────────────
# Build agent
# ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """คุณเป็น Sales Assistant ชื่อ น้องขายไว ตอบภาษาไทยสุภาพ ใช้ค่ะ

กฎสำคัญ:
- ตอบเป็นประโยคธรรมชาติเหมือนคนพูด ห้ามใช้ตาราง markdown (| --- |) เด็ดขาด
- ใช้ bullet points (-) แทนตารางเมื่อต้องแสดงรายการ
- ตอบสั้นกระชับ 3-5 บรรทัด ไม่ต้องยาว
- ห้ามแสดง UUID/ID ให้ผู้ใช้ แปลงเป็นชื่อเสมอ
- ใช้ tools ดึงข้อมูลจริงเสมอ ห้ามเดา
- ใช้ tenantId="default" เป็นค่าเริ่มต้น
- ทำ action ได้เลย: assign lead, สร้าง QT, อนุมัติ, สร้าง task
- ถ้าต้องการวิเคราะห์เชิงลึก KPI/forecast ให้ใช้ ask_analytics เพื่อถามน้องวิ

ตัวอย่างที่ดี:
- ตอนนี้มี Lead ที่ยังไม่ได้ assign 2 คนค่ะ คือคุณ Nartbodee จาก Intervision กับคุณวิชัย จากกรุงเทพซอฟต์ มูลค่าประมาณ 87,500 บาท อยากให้ assign ให้ใครดีคะ?

ตัวอย่างที่ไม่ดี:
- | # | ชื่อ | บริษัท | (ห้ามใช้ตาราง)
"""


class SalesAgent:
    """Wraps Strands Agent with memory injection."""

    def __init__(self):
        self.model = BedrockModel(model_id=MODEL_ID, region_name=REGION)
        self.tools = [
            search_leads,
            assign_lead,
            create_lead,
            search_accounts,
            get_account_detail,
            search_products,
            create_quotation,
            approve_quotation,
            search_tasks,
            create_task,
            search_opportunities,
            get_users,
            log_activity,
            send_notification,
            ask_analytics,
        ]

    def run(self, message: str, session_id: str, actor_id: str, tenant_id: str = "default") -> str:
        # Skip memory load for now — old events may have incompatible format
        retrieved_facts = memory_retrieve_context(actor_id, message, max_results=3)

        # Build context-aware system prompt
        prompt = SYSTEM_PROMPT
        if retrieved_facts:
            prompt += "\n\nข้อมูลที่จำได้จากการสนทนาก่อนหน้า:\n" + "\n".join(f"- {f}" for f in retrieved_facts)

        # Fresh agent context (no replay of historical messages to avoid format issues)
        agent = Agent(
            model=self.model,
            tools=self.tools,
            system_prompt=prompt,
        )

        # Save user message to memory
        memory_save_event(session_id, actor_id, "USER", message)

        # Invoke agent
        try:
            result = agent(message)
            reply = str(result) if result else ""
        except Exception as e:
            print(f"[agent.run] error: {e}", flush=True)
            import traceback
            traceback.print_exc()
            reply = f"ขออภัยค่ะ มีข้อผิดพลาดเกิดขึ้น: {str(e)[:200]}"

        # Save assistant reply to memory
        if reply:
            memory_save_event(session_id, actor_id, "ASSISTANT", reply)

        return reply


def build_agent():
    return SalesAgent()
