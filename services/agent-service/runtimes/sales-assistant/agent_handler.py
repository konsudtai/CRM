"""น้องขายไว — Sales Assistant Runtime"""
import json, os, traceback, boto3, urllib.request, urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8080"))
REGION = os.environ.get("BEDROCK_REGION", "ap-southeast-1")
MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "global.anthropic.claude-sonnet-4-6")
GATEWAY_URL = os.environ.get("GATEWAY_URL", "https://sf7-crm-gateway-zd795zpjtz.gateway.bedrock-agentcore.ap-southeast-1.amazonaws.com/mcp")
ANALYTICS_RUNTIME_ARN = os.environ.get("ANALYTICS_RUNTIME_ARN", "")

bedrock = boto3.client("bedrock-runtime", region_name=REGION)
agentcore = boto3.client("bedrock-agentcore", region_name=REGION)

GATEWAY_PREFIX = "sf7-crm-tools___"
SYSTEM = """คุณเป็น Sales Personal Assistant ชื่อ "น้องขายไว" ตอบภาษาไทย ใช้ค่ะ
คุณทำ action แทน manual ได้เลย: assign lead, สร้าง QT, อนุมัติ, สร้าง task, ปิด deal
ใช้ tools ดึงข้อมูลจริงเสมอ ตอบสั้นกระชับ ใช้ tenantId=default
ถ้าต้องการวิเคราะห์/forecast ให้ใช้ ask_analytics
ห้ามใช้ markdown formatting เช่น ** หรือ ## หรือ ``` — ตอบเป็น plain text เท่านั้น

กฎสำคัญเรื่องความเร็ว:
- ใช้ tool น้อยที่สุดเท่าที่จำเป็น (ไม่เกิน 2-3 calls ต่อคำถาม)
- ถ้า user บอกชื่อ lead/account → search ด้วยชื่อนั้นเลย ไม่ต้องถามซ้ำ
- ถ้า user สั่ง assign → search lead + get users + assign ในรอบเดียวกัน
- ถ้าข้อมูลไม่ครบ → ถามกลับทันที ไม่ต้องเรียก tool
- ห้ามเรียก tool ซ้ำถ้าได้ข้อมูลแล้ว
- ถ้า user ถาม "Lead ของ [ชื่อคน]" หมายถึง Lead ที่ assign ให้คนนั้น → ใช้ get_users หา user ID ก่อน แล้ว search_leads ด้วย assignedTo
- ถ้า user ถาม "Lead [ชื่อ]" โดยไม่มีคำว่า "ของ" → search ด้วยชื่อ lead นั้น"""

TOOLS = [
    {"name":"search_leads","description":"ค้นหา Lead ตาม status, ชื่อ, หรือ Sales Rep ที่ดูแล","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"status":{"type":"string"},"search":{"type":"string"},"assignedTo":{"type":"string","description":"User ID ของ Sales Rep ที่ดูแล Lead"},"limit":{"type":"number"}},"required":["tenantId"]}}},
    {"name":"assign_lead","description":"มอบหมาย Lead ให้ Sales Rep","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"leadId":{"type":"string"},"assignToUserId":{"type":"string"},"assignToName":{"type":"string"}},"required":["tenantId","leadId","assignToUserId","assignToName"]}}},
    {"name":"create_lead","description":"สร้าง Lead ใหม่","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"name":{"type":"string"},"companyName":{"type":"string"},"phone":{"type":"string"},"email":{"type":"string"},"source":{"type":"string"},"notes":{"type":"string"}},"required":["tenantId","name"]}}},
    {"name":"search_accounts","description":"ค้นหา Account","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"search":{"type":"string"},"limit":{"type":"number"}},"required":["tenantId","search"]}}},
    {"name":"get_account_detail","description":"ดูรายละเอียด Account","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"accountId":{"type":"string"}},"required":["tenantId","accountId"]}}},
    {"name":"search_products","description":"ค้นหาสินค้า","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"search":{"type":"string"}},"required":["tenantId"]}}},
    {"name":"create_quotation","description":"สร้างใบเสนอราคา","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"accountId":{"type":"string"},"lineItems":{"type":"array"},"notes":{"type":"string"}},"required":["tenantId","accountId","lineItems"]}}},
    {"name":"approve_quotation","description":"อนุมัติใบเสนอราคา","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"quotationId":{"type":"string"},"approvedBy":{"type":"string"}},"required":["tenantId","quotationId","approvedBy"]}}},
    {"name":"search_tasks","description":"ค้นหา Task","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"assignedTo":{"type":"string"},"status":{"type":"string"},"overdue":{"type":"boolean"}},"required":["tenantId"]}}},
    {"name":"create_task","description":"สร้าง Task","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"title":{"type":"string"},"assignedTo":{"type":"string"},"dueDate":{"type":"string"},"priority":{"type":"string"}},"required":["tenantId","title","assignedTo","dueDate"]}}},
    {"name":"search_opportunities","description":"ค้นหา Deal","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"stage":{"type":"string"}},"required":["tenantId"]}}},
    {"name":"get_users","description":"ดึงรายชื่อ Users","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"}},"required":["tenantId"]}}},
    {"name":"log_activity","description":"บันทึก Activity","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"entityType":{"type":"string"},"entityId":{"type":"string"},"summary":{"type":"string"}},"required":["tenantId","entityType","entityId","summary"]}}},
    {"name":"send_notification","description":"ส่ง notification","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"userId":{"type":"string"},"type":{"type":"string"},"title":{"type":"string"},"body":{"type":"string"}},"required":["tenantId","userId","type","title","body"]}}},
    {"name":"ask_analytics","description":"ถามน้องวิ วิเคราะห์ข้อมูล forecast/KPI/pipeline","inputSchema":{"json":{"type":"object","properties":{"question":{"type":"string"}},"required":["question"]}}},
]

def call_gateway(tool_name, args):
    mcp = {"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":GATEWAY_PREFIX+tool_name,"arguments":args}}
    req = urllib.request.Request(GATEWAY_URL, data=json.dumps(mcp).encode(), headers={"Content-Type":"application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=25) as r:
        res = json.loads(r.read().decode())
        txt = res.get("result",{}).get("content",[{}])[0].get("text","{}") 
        inner = json.loads(txt)
        return json.loads(inner["body"]) if "body" in inner else inner

def call_a2a(runtime_arn, question):
    if not runtime_arn: return {"error": "Runtime not configured"}
    resp = agentcore.invoke_agent_runtime(agentRuntimeArn=runtime_arn, payload=json.dumps({"message":question}).encode(), contentType="application/json", accept="application/json")
    return json.loads(resp["response"].read().decode())

def execute_tool(name, args):
    if name == "ask_analytics":
        r = call_a2a(ANALYTICS_RUNTIME_ARN, args["question"])
        return {"answer": r.get("reply", str(r))}
    return call_gateway(name, args)

def sanitize(content):
    out = [b for b in content if not ("text" in b and not b["text"].strip())]
    return out if out else [{"text": " "}]

def invoke(message):
    tools_config = {"tools": [{"toolSpec": {"name":t["name"],"description":t["description"],"inputSchema":t["inputSchema"]}} for t in TOOLS]}
    messages = [{"role":"user","content":[{"text":message}]}]
    for _ in range(6):
        resp = bedrock.converse(modelId=MODEL_ID, system=[{"text":SYSTEM}], messages=messages, toolConfig=tools_config, inferenceConfig={"maxTokens":2048,"temperature":0.3})
        output = resp["output"]["message"]
        output["content"] = sanitize(output["content"])
        messages.append(output)
        tool_uses = [b for b in output["content"] if "toolUse" in b]
        if not tool_uses:
            return "\n".join(b["text"] for b in output["content"] if "text" in b and b["text"])
        results = []
        for tu in tool_uses:
            t = tu["toolUse"]
            try:
                r = execute_tool(t["name"], t["input"])
                if isinstance(r, dict):
                    results.append({"toolResult":{"toolUseId":t["toolUseId"],"content":[{"json":r}]}})
                elif isinstance(r, list):
                    results.append({"toolResult":{"toolUseId":t["toolUseId"],"content":[{"json":{"data":r,"count":len(r)}}]}})
                else:
                    results.append({"toolResult":{"toolUseId":t["toolUseId"],"content":[{"text":str(r)}]}})
            except Exception as e:
                results.append({"toolResult":{"toolUseId":t["toolUseId"],"content":[{"text":f"Error: {e}"}],"status":"error"}})
        messages.append({"role":"user","content":results})
    return "ขออภัยค่ะ ไม่สามารถประมวลผลได้"

class H(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path=="/ping":
            self.send_response(200);self.send_header("Content-Type","application/json");self.end_headers();self.wfile.write(b'{"status":"Healthy"}')
        else: self.send_response(404);self.end_headers()
    def do_POST(self):
        if self.path=="/invocations":
            body=self.rfile.read(int(self.headers.get("Content-Length",0)))
            try: p=json.loads(body)
            except: p={"message":body.decode()}
            msg=p.get("message",p.get("prompt",str(p)))
            try: reply=invoke(msg);out=json.dumps({"reply":reply,"agentUsed":"น้องขายไว","via":"AgentCore Gateway"},ensure_ascii=False)
            except Exception as e: print(f"[ERR]{traceback.format_exc()}");out=json.dumps({"reply":f"ขออภัยค่ะ: {e}","error":str(e)},ensure_ascii=False)
            self.send_response(200);self.send_header("Content-Type","application/json");self.end_headers();self.wfile.write(out.encode())
        else: self.send_response(404);self.end_headers()
    def log_message(self,*a): pass

if __name__=="__main__":
    print(f"[น้องขายไว] port={PORT} model={MODEL_ID}");HTTPServer(("0.0.0.0",PORT),H).serve_forever()
