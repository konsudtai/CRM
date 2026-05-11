"""
SalesFAST 7 — Multi-Agent (AgentCore Runtime)
Calls Tool Lambda directly via boto3 (bypasses MCP prefix issue).
"""
import json, os, traceback, boto3
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8080"))
REGION = os.environ.get("BEDROCK_REGION", os.environ.get("AWS_REGION", "ap-southeast-1"))
MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "apac.anthropic.claude-sonnet-4-20250514-v1:0")
TOOL_LAMBDA = os.environ.get("TOOL_LAMBDA", "sf7-prod-agent-tools")

bedrock = boto3.client("bedrock-runtime", region_name=REGION)
lam = boto3.client("lambda", region_name=REGION)

TOOLS_SCHEMA = [
    {"name":"search_leads","description":"ค้นหา Lead ตาม status/ชื่อ/assigned","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"status":{"type":"string"},"search":{"type":"string"},"limit":{"type":"number"}},"required":["tenantId"]}}},
    {"name":"assign_lead","description":"มอบหมาย Lead ให้ Sales Rep","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"leadId":{"type":"string"},"assignToUserId":{"type":"string"},"assignToName":{"type":"string"}},"required":["tenantId","leadId","assignToUserId","assignToName"]}}},
    {"name":"create_lead","description":"สร้าง Lead ใหม่","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"name":{"type":"string"},"companyName":{"type":"string"},"phone":{"type":"string"},"email":{"type":"string"},"source":{"type":"string"},"notes":{"type":"string"}},"required":["tenantId","name"]}}},
    {"name":"search_accounts","description":"ค้นหา Account ตามชื่อบริษัท","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"search":{"type":"string"},"limit":{"type":"number"}},"required":["tenantId","search"]}}},
    {"name":"get_account_detail","description":"ดูรายละเอียด Account","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"accountId":{"type":"string"}},"required":["tenantId","accountId"]}}},
    {"name":"search_products","description":"ค้นหาสินค้า","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"search":{"type":"string"},"category":{"type":"string"}},"required":["tenantId"]}}},
    {"name":"create_quotation","description":"สร้างใบเสนอราคา","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"accountId":{"type":"string"},"lineItems":{"type":"array"},"notes":{"type":"string"}},"required":["tenantId","accountId","lineItems"]}}},
    {"name":"approve_quotation","description":"อนุมัติใบเสนอราคา","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"quotationId":{"type":"string"},"approvedBy":{"type":"string"}},"required":["tenantId","quotationId","approvedBy"]}}},
    {"name":"search_tasks","description":"ค้นหา Task","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"assignedTo":{"type":"string"},"status":{"type":"string"},"overdue":{"type":"boolean"}},"required":["tenantId"]}}},
    {"name":"create_task","description":"สร้าง Task ใหม่","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"title":{"type":"string"},"assignedTo":{"type":"string"},"dueDate":{"type":"string"},"priority":{"type":"string"}},"required":["tenantId","title","assignedTo","dueDate"]}}},
    {"name":"search_opportunities","description":"ค้นหา Deal/Opportunity","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"stage":{"type":"string"},"ownerId":{"type":"string"}},"required":["tenantId"]}}},
    {"name":"get_kpi_summary","description":"ดึง KPI สรุป","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"period":{"type":"string"}},"required":["tenantId"]}}},
    {"name":"get_pipeline_analysis","description":"วิเคราะห์ pipeline","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"}},"required":["tenantId"]}}},
    {"name":"get_revenue_data","description":"ดึง revenue รายเดือน","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"year":{"type":"number"}},"required":["tenantId"]}}},
    {"name":"get_forecast","description":"พยากรณ์ revenue","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"}},"required":["tenantId"]}}},
    {"name":"get_users","description":"ดึงรายชื่อ Users","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"}},"required":["tenantId"]}}},
    {"name":"log_activity","description":"บันทึก Activity","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"entityType":{"type":"string"},"entityId":{"type":"string"},"summary":{"type":"string"}},"required":["tenantId","entityType","entityId","summary"]}}},
    {"name":"send_notification","description":"ส่ง notification","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"userId":{"type":"string"},"type":{"type":"string"},"title":{"type":"string"},"body":{"type":"string"}},"required":["tenantId","userId","type","title","body"]}}},
]

SYSTEM_PROMPTS = {
    "sales-assistant": "คุณเป็น Sales Assistant ชื่อ น้องขายไว ตอบภาษาไทย ใช้ค่ะ ใช้ tools ดึงข้อมูลจริง ตอบสั้นกระชับ ใช้ tenantId=default",
    "admin-ai": "คุณเป็นผู้ช่วยฝ่ายขาย ชื่อ น้องแอ๊ด ตอบภาษาไทย ใช้ค่ะ ตอบคำถามสินค้า สร้าง Lead เมื่อได้ข้อมูลครบ ใช้ tenantId=default",
    "analytics": "คุณเป็นนักวิเคราะห์ ชื่อ น้องวิ ตอบภาษาไทย ใช้ค่ะ วิเคราะห์ข้อมูลจาก tools จบด้วยคำแนะนำ ใช้ tenantId=default",
}


def call_tool(name, args):
    """Invoke Tool Lambda directly."""
    resp = lam.invoke(
        FunctionName=TOOL_LAMBDA,
        Payload=json.dumps({"name": name, "arguments": args}).encode()
    )
    result = json.loads(resp["Payload"].read().decode())
    body = result.get("body", "{}")
    return json.loads(body) if isinstance(body, str) else body


def invoke_agent(agent_type, message):
    """Converse with tool use loop."""
    system = SYSTEM_PROMPTS.get(agent_type, SYSTEM_PROMPTS["sales-assistant"])
    tools_config = {"tools": [{"toolSpec": {"name": t["name"], "description": t["description"], "inputSchema": t["inputSchema"]}} for t in TOOLS_SCHEMA]}

    messages = [{"role": "user", "content": [{"text": message}]}]

    for _ in range(5):  # max 5 tool rounds
        resp = bedrock.converse(
            modelId=MODEL_ID,
            system=[{"text": system}],
            messages=messages,
            toolConfig=tools_config,
            inferenceConfig={"maxTokens": 2048, "temperature": 0.3},
        )
        output = resp["output"]["message"]
        messages.append(output)

        # Check if model wants to use tools
        tool_uses = [b for b in output["content"] if "toolUse" in b]
        if not tool_uses:
            # No tool call — extract text
            texts = [b["text"] for b in output["content"] if "text" in b]
            return "\n".join(texts)

        # Execute tools
        tool_results = []
        for tu in tool_uses:
            tool = tu["toolUse"]
            print(f"[TOOL] {tool['name']}({json.dumps(tool['input'], ensure_ascii=False)[:100]})")
            try:
                result = call_tool(tool["name"], tool["input"])
                tool_results.append({"toolResult": {"toolUseId": tool["toolUseId"], "content": [{"json": result}]}})
            except Exception as e:
                tool_results.append({"toolResult": {"toolUseId": tool["toolUseId"], "content": [{"text": f"Error: {e}"}], "status": "error"}})

        messages.append({"role": "user", "content": tool_results})

    return "ขออภัยค่ะ ไม่สามารถประมวลผลได้"


def detect_agent(msg):
    lower = msg.lower()
    if any(k in lower for k in ['forecast', 'kpi', 'วิเคราะห์', 'revenue', 'churn']): return 'analytics'
    return 'sales-assistant'


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/ping":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"Healthy"}')
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/invocations":
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            try:
                p = json.loads(body)
            except:
                p = {"message": body.decode()}
            msg = p.get("message", p.get("prompt", str(p)))
            at = p.get("agentType", "auto")
            if at == "auto": at = detect_agent(msg)

            try:
                reply = invoke_agent(at, msg)
                out = json.dumps({"reply": reply, "agentUsed": at, "model": MODEL_ID}, ensure_ascii=False)
            except Exception as e:
                print(f"[ERR] {traceback.format_exc()}")
                out = json.dumps({"reply": f"ขออภัยค่ะ: {e}", "error": str(e), "agentUsed": at}, ensure_ascii=False)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(out.encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *a): pass


if __name__ == "__main__":
    print(f"[START] port={PORT} model={MODEL_ID}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
