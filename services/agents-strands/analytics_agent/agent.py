"""
น้องวิ (Analytics Specialist) — Strands SDK
- Tools: AgentCore Gateway (MCP) — KPI, pipeline, forecast
- Memory: AgentCore Memory (sf7_analytics_memory)
- A2A: ask_sales → call น้องขายไว runtime
"""
import os
import json

from strands import Agent, tool
from strands.models import BedrockModel

import boto3
import urllib.request
import urllib.error

# ── Configuration ──
REGION = os.environ.get("AWS_REGION", "ap-southeast-1")
MODEL_ID = os.environ.get("MODEL_ID", "global.anthropic.claude-sonnet-4-6")
MEMORY_ID = os.environ.get("MEMORY_ID", "sf7_agents_memory-Ye8E3AGtiH")
GATEWAY_URL = os.environ.get("GATEWAY_URL", "https://sf7-crm-gateway-zd795zpjtz.gateway.bedrock-agentcore.ap-southeast-1.amazonaws.com/mcp")
GATEWAY_TOKEN = os.environ.get("GATEWAY_TOKEN", "")
SALES_RUNTIME_ARN = os.environ.get("SALES_RUNTIME_ARN", "")
TOOL_PREFIX = os.environ.get("TOOL_PREFIX", "sf7-crm-tools___")

_bedrock_agentcore = boto3.client("bedrock-agentcore", region_name=REGION)


# ──────────────────────────────────────────────────────────────
# Memory helpers
# ──────────────────────────────────────────────────────────────

def memory_save_event(session_id: str, actor_id: str, role: str, text: str):
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
    try:
        resp = _bedrock_agentcore.list_events(
            memoryId=MEMORY_ID,
            actorId=actor_id,
            sessionId=session_id,
            maxResults=max_results,
            includePayloads=True,
        )
        events = resp.get("events", [])
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
    try:
        resp = _bedrock_agentcore.retrieve_memory_records(
            memoryId=MEMORY_ID,
            namespace=f"/analytics/{actor_id}/context",
            searchCriteria={"searchQuery": query, "topK": max_results},
        )
        records = resp.get("memoryRecordSummaries", [])
        return [r.get("content", {}).get("text", "") for r in records]
    except Exception as e:
        print(f"[memory] retrieve error: {e}", flush=True)
        return []


# ──────────────────────────────────────────────────────────────
# Gateway MCP wrapper
# ──────────────────────────────────────────────────────────────

def _call_gateway(tool_name: str, arguments: dict) -> str:
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
            return f"Result: {txt}"
    except urllib.error.HTTPError as e:
        return f"Gateway HTTP {e.code}: {e.read().decode()[:300]}"
    except Exception as e:
        return f"Gateway error: {e}"


# ──────────────────────────────────────────────────────────────
# Analytics tools
# ──────────────────────────────────────────────────────────────

@tool
def get_kpi_summary(tenant_id: str = "default", period: str = "month") -> str:
    """ดึง KPI สรุป (revenue, deals won, win rate) สำหรับ period ที่กำหนด"""
    return _call_gateway("get_kpi_summary", {"tenantId": tenant_id, "period": period})


@tool
def get_pipeline_analysis(tenant_id: str = "default") -> str:
    """วิเคราะห์ pipeline ทุก stage (จำนวน, มูลค่า, อายุเฉลี่ย)"""
    return _call_gateway("get_pipeline_analysis", {"tenantId": tenant_id})


@tool
def get_revenue_data(tenant_id: str = "default", year: int = 2026) -> str:
    """ดึงข้อมูล revenue รายเดือนใน year ที่กำหนด"""
    return _call_gateway("get_revenue_data", {"tenantId": tenant_id, "year": year})


@tool
def get_forecast(tenant_id: str = "default") -> str:
    """พยากรณ์ revenue เดือนหน้า (Conservative/Expected/Optimistic)"""
    return _call_gateway("get_forecast", {"tenantId": tenant_id})


@tool
def search_opportunities(tenant_id: str = "default", stage: str = "") -> str:
    """ค้นหา Deal/Opportunity แยกตาม stage"""
    args = {"tenantId": tenant_id}
    if stage:
        args["stage"] = stage
    return _call_gateway("search_opportunities", args)


@tool
def get_users(tenant_id: str = "default") -> str:
    """ดึงรายชื่อ Sales Rep / Users"""
    return _call_gateway("get_users", {"tenantId": tenant_id})


@tool
def ask_sales(question: str) -> str:
    """ถามน้องขายไว เพื่อขอข้อมูล CRM (lead status, account detail, task) — A2A protocol"""
    if not SALES_RUNTIME_ARN:
        return json.dumps({"error": "Sales runtime not configured"})
    try:
        resp = _bedrock_agentcore.invoke_agent_runtime(
            agentRuntimeArn=SALES_RUNTIME_ARN,
            payload=json.dumps({"message": question, "sessionId": "a2a-from-analytics"}).encode(),
            contentType="application/json",
            accept="application/json",
        )
        data = json.loads(resp["response"].read().decode())
        return data.get("reply", str(data))
    except Exception as e:
        return json.dumps({"error": f"A2A failed: {e}"})


# ──────────────────────────────────────────────────────────────
# Agent
# ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """คุณเป็นนักวิเคราะห์ ชื่อ น้องวิ ตอบภาษาไทยสุภาพ ใช้ค่ะ

กฎสำคัญ:
- ตอบเป็นประโยคธรรมชาติเหมือนคนพูด ห้ามใช้ตาราง markdown (| --- |) เด็ดขาด
- สรุปตัวเลขเป็นประโยค เช่น "ตอนนี้ pipeline มีมูลค่ารวม 177 ล้านบาท โดย Proposal stage สูงสุดที่ 110 ล้าน"
- ใช้ bullet points (-) แทนตารางเมื่อต้องแสดงรายการ
- ใช้ตัวเลขจริงจาก tools เสมอ ห้ามสมมติ
- จบด้วยคำแนะนำ 1-3 ข้อ ที่ทำได้จริง
- ใช้ tenantId="default" เป็นค่าเริ่มต้น
- ถ้าต้องการข้อมูล CRM (lead, account, task) ให้ใช้ ask_sales เพื่อถามน้องขายไว
"""


class AnalyticsAgent:
    def __init__(self):
        self.model = BedrockModel(model_id=MODEL_ID, region_name=REGION)
        self.tools = [
            get_kpi_summary,
            get_pipeline_analysis,
            get_revenue_data,
            get_forecast,
            search_opportunities,
            get_users,
            ask_sales,
        ]

    def run(self, message: str, session_id: str, actor_id: str, tenant_id: str = "default") -> str:
        # Skip memory load for now — old events may have incompatible format
        # Memory still saves new events, will use semantic retrieval only
        retrieved_facts = memory_retrieve_context(actor_id, message, max_results=3)

        prompt = SYSTEM_PROMPT
        if retrieved_facts:
            prompt += "\n\nข้อมูลที่จำได้จากการสนทนาก่อนหน้า:\n" + "\n".join(f"- {f}" for f in retrieved_facts)

        # Empty messages — fresh context each time (Strands accumulates within agent)
        agent = Agent(
            model=self.model,
            tools=self.tools,
            system_prompt=prompt,
        )

        memory_save_event(session_id, actor_id, "USER", message)

        try:
            result = agent(message)
            reply = str(result) if result else ""
        except Exception as e:
            print(f"[agent.run] error: {e}", flush=True)
            import traceback
            traceback.print_exc()
            reply = f"ขออภัยค่ะ มีข้อผิดพลาดเกิดขึ้น: {str(e)[:200]}"

        if reply:
            memory_save_event(session_id, actor_id, "ASSISTANT", reply)

        return reply


def build_agent():
    return AnalyticsAgent()
