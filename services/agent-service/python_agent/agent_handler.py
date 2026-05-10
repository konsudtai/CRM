"""
SalesFAST 7 — Sales Assistant Agent (AgentCore Runtime)
น้องขายไว — Sales Personal Assistant

Deployed to Amazon Bedrock AgentCore Runtime via direct_code_deploy.
Uses Strands Agents Python SDK with Amazon Nova 2 Lite model.
"""
import json
import os
from strands import Agent, tool
from strands.models.bedrock import BedrockModel

# ── Configuration ──
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "ap-southeast-1")
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-2-lite-v1:0")
CRM_API_BASE = os.environ.get("CRM_API_BASE", "")

# ── Tools ──

@tool
def search_leads(query: str = "", status: str = "") -> str:
    """ค้นหา Lead ในระบบ CRM ตาม query หรือ status"""
    import urllib.request
    params = []
    if query: params.append(f"search={query}")
    if status: params.append(f"status={status}")
    url = f"{CRM_API_BASE}/leads?{'&'.join(params)}&limit=20"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.read().decode()
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def search_accounts(query: str = "") -> str:
    """ค้นหาลูกค้า (Accounts) ในระบบ CRM"""
    import urllib.request
    url = f"{CRM_API_BASE}/accounts?search={query}&limit=20"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.read().decode()
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def search_products(query: str = "") -> str:
    """ค้นหาสินค้าในระบบ"""
    import urllib.request
    url = f"{CRM_API_BASE}/products?search={query}&limit=20"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.read().decode()
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def get_dashboard_kpi(period: str = "month") -> str:
    """ดึงข้อมูล KPI Dashboard (revenue, leads, conversion)"""
    import urllib.request
    url = f"{CRM_API_BASE}/dashboard/kpi?period={period}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.read().decode()
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def create_task(title: str, due_date: str = "", priority: str = "Medium", assigned_to: str = "") -> str:
    """สร้าง Task ใหม่ในระบบ CRM"""
    import urllib.request
    data = json.dumps({
        "title": title,
        "dueDate": due_date,
        "priority": priority,
        "assignedTo": assigned_to or None,
    }).encode()
    try:
        req = urllib.request.Request(f"{CRM_API_BASE}/tasks", data=data, method="POST")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.read().decode()
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def send_notification(user_id: str, title: str, body: str = "") -> str:
    """ส่งการแจ้งเตือนให้ผู้ใช้"""
    import urllib.request
    data = json.dumps({
        "userId": user_id,
        "title": title,
        "body": body,
        "type": "general",
    }).encode()
    try:
        req = urllib.request.Request(f"{CRM_API_BASE}/notifications", data=data, method="POST")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.read().decode()
    except Exception as e:
        return json.dumps({"error": str(e)})


# ── Agent ──

SYSTEM_PROMPT = """คุณเป็น Sales Personal Assistant ชื่อ "น้องขายไว" ทำงานเหมือนเพื่อนร่วมทีมขายที่เก่งมาก
ตอบเป็นภาษาไทย สุภาพ ใช้ค่ะ มีความเป็นมิตร

## สิ่งที่ทำได้:
- ค้นหาข้อมูลลูกค้า, Lead, สินค้า
- ดู KPI Dashboard
- สร้าง Task
- ส่งการแจ้งเตือน
- ให้คำแนะนำเรื่องการขาย

## หลักการ:
1. ใช้ข้อมูลจริงจาก API เสมอ — ห้ามสมมติ
2. ตอบสั้น กระชับ ใช้ emoji เล็กน้อย
3. ใช้ bullet points อ่านง่าย
4. หลังทำ action → สรุปสิ่งที่ทำให้ชัดเจน
"""

model = BedrockModel(
    model_id=BEDROCK_MODEL_ID,
    region_name=BEDROCK_REGION,
)

agent = Agent(
    model=model,
    tools=[search_leads, search_accounts, search_products, get_dashboard_kpi, create_task, send_notification],
    system_prompt=SYSTEM_PROMPT,
)


# ── AgentCore Handler ──

def handler(event, context):
    """
    AgentCore Runtime handler.
    Receives message, invokes agent, returns response.
    """
    # Parse input
    if isinstance(event, str):
        try:
            event = json.loads(event)
        except json.JSONDecodeError:
            event = {"message": event}

    message = event.get("message", event.get("prompt", str(event)))
    
    # Invoke agent
    try:
        result = agent(message)
        
        # Extract text response
        if hasattr(result, 'message'):
            reply = result.message
        elif isinstance(result, str):
            reply = result
        else:
            reply = str(result)
        
        return {
            "statusCode": 200,
            "body": json.dumps({
                "reply": reply,
                "agentType": "sales-assistant",
            }, ensure_ascii=False)
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": str(e),
                "reply": f"ขออภัยค่ะ เกิดข้อผิดพลาด: {str(e)}",
            }, ensure_ascii=False)
        }
