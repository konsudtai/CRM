"""SalesFAST 7 — Universal Agent Handler. Detects role from AGENT_ROLE env."""
import json, os, traceback, boto3, urllib.request, urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8080"))
REGION = os.environ.get("BEDROCK_REGION", "ap-southeast-1")
MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "apac.anthropic.claude-sonnet-4-20250514-v1:0")
GATEWAY_URL = os.environ.get("GATEWAY_URL", "https://sf7-crm-gateway-zd795zpjtz.gateway.bedrock-agentcore.ap-southeast-1.amazonaws.com/mcp")
AGENT_ROLE = os.environ.get("AGENT_ROLE", "sales-assistant")
SALES_ARN = os.environ.get("SALES_RUNTIME_ARN", "arn:aws:bedrock-agentcore:ap-southeast-1:364478544994:runtime/sf7_agents_v2-HGDCxK46cL")
ANALYTICS_ARN = os.environ.get("ANALYTICS_RUNTIME_ARN", "arn:aws:bedrock-agentcore:ap-southeast-1:364478544994:runtime/sf7_analytics-AY5sRH2Qtv")
ADMIN_ARN = os.environ.get("ADMIN_RUNTIME_ARN", "arn:aws:bedrock-agentcore:ap-southeast-1:364478544994:runtime/sf7_admin_ai-iWwNN6CdL3")

bedrock = boto3.client("bedrock-runtime", region_name=REGION)
ac = boto3.client("bedrock-agentcore", region_name=REGION)
GP = "sf7-crm-tools___"

CONFIGS = {
    "sales-assistant": {
        "name": "น้องขายไว",
        "system": "คุณเป็น Sales Assistant ชื่อ น้องขายไว ตอบภาษาไทย ใช้ค่ะ ทำ action แทน manual ได้เลย: assign lead, สร้าง QT, อนุมัติ, สร้าง task, ปิด deal ใช้ tools ดึงข้อมูลจริง ตอบสั้นกระชับ ใช้ tenantId=default ถ้าต้องการวิเคราะห์ให้ใช้ ask_analytics",
        "tools": ["search_leads","assign_lead","create_lead","search_accounts","get_account_detail","search_products","create_quotation","approve_quotation","search_tasks","create_task","search_opportunities","get_users","log_activity","send_notification","ask_analytics"],
    },
    "admin-ai": {
        "name": "น้องแอ๊ด",
        "system": "คุณเป็นผู้ช่วยฝ่ายขาย ชื่อ น้องแอ๊ด ตอบภาษาไทย ใช้ค่ะ ตอบสั้น 3-4 บรรทัด เมื่อได้ข้อมูลครบ(ชื่อ+เบอร์+สนใจอะไร)สร้าง Lead ทันที ห้ามให้ส่วนลด ใช้ tenantId=default ถ้าตอบไม่ได้ใช้ ask_sales_assistant",
        "tools": ["search_products","create_lead","search_accounts","send_notification","ask_sales_assistant"],
    },
    "analytics": {
        "name": "น้องวิ",
        "system": "คุณเป็นนักวิเคราะห์ ชื่อ น้องวิ ตอบภาษาไทย ใช้ค่ะ ใช้ตัวเลขจริงจาก tools ห้ามสมมติ ใช้ emoji(📈📉⚠️✅🎯) จบด้วยคำแนะนำ 1-3 ข้อ ใช้ tenantId=default ถ้าต้องการข้อมูล CRM ใช้ ask_sales_assistant",
        "tools": ["get_kpi_summary","get_pipeline_analysis","get_revenue_data","get_forecast","search_opportunities","get_users","ask_sales_assistant"],
    },
}

ALL_TOOLS = {
    "search_leads":{"description":"ค้นหา Lead","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"status":{"type":"string"},"search":{"type":"string"},"limit":{"type":"number"}},"required":["tenantId"]}}},
    "assign_lead":{"description":"มอบหมาย Lead","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"leadId":{"type":"string"},"assignToUserId":{"type":"string"},"assignToName":{"type":"string"}},"required":["tenantId","leadId","assignToUserId","assignToName"]}}},
    "create_lead":{"description":"สร้าง Lead ใหม่","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"name":{"type":"string"},"companyName":{"type":"string"},"phone":{"type":"string"},"email":{"type":"string"},"source":{"type":"string"},"notes":{"type":"string"}},"required":["tenantId","name"]}}},
    "search_accounts":{"description":"ค้นหา Account","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"search":{"type":"string"},"limit":{"type":"number"}},"required":["tenantId","search"]}}},
    "get_account_detail":{"description":"ดูรายละเอียด Account","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"accountId":{"type":"string"}},"required":["tenantId","accountId"]}}},
    "search_products":{"description":"ค้นหาสินค้า","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"search":{"type":"string"}},"required":["tenantId"]}}},
    "create_quotation":{"description":"สร้างใบเสนอราคา","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"accountId":{"type":"string"},"lineItems":{"type":"array"},"notes":{"type":"string"}},"required":["tenantId","accountId","lineItems"]}}},
    "approve_quotation":{"description":"อนุมัติใบเสนอราคา","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"quotationId":{"type":"string"},"approvedBy":{"type":"string"}},"required":["tenantId","quotationId","approvedBy"]}}},
    "search_tasks":{"description":"ค้นหา Task","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"assignedTo":{"type":"string"},"status":{"type":"string"},"overdue":{"type":"boolean"}},"required":["tenantId"]}}},
    "create_task":{"description":"สร้าง Task","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"title":{"type":"string"},"assignedTo":{"type":"string"},"dueDate":{"type":"string"},"priority":{"type":"string"}},"required":["tenantId","title","assignedTo","dueDate"]}}},
    "search_opportunities":{"description":"ค้นหา Deal","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"stage":{"type":"string"}},"required":["tenantId"]}}},
    "get_kpi_summary":{"description":"ดึง KPI สรุป","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"period":{"type":"string"}},"required":["tenantId"]}}},
    "get_pipeline_analysis":{"description":"วิเคราะห์ pipeline","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"}},"required":["tenantId"]}}},
    "get_revenue_data":{"description":"ดึง revenue","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"year":{"type":"number"}},"required":["tenantId"]}}},
    "get_forecast":{"description":"พยากรณ์ revenue","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"}},"required":["tenantId"]}}},
    "get_users":{"description":"ดึงรายชื่อ Users","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"}},"required":["tenantId"]}}},
    "log_activity":{"description":"บันทึก Activity","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"entityType":{"type":"string"},"entityId":{"type":"string"},"summary":{"type":"string"}},"required":["tenantId","entityType","entityId","summary"]}}},
    "send_notification":{"description":"ส่ง notification","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"userId":{"type":"string"},"type":{"type":"string"},"title":{"type":"string"},"body":{"type":"string"}},"required":["tenantId","userId","type","title","body"]}}},
    "ask_sales_assistant":{"description":"ถามน้องขายไว เรื่อง CRM/Lead/Account/QT","inputSchema":{"json":{"type":"object","properties":{"question":{"type":"string"}},"required":["question"]}}},
    "ask_analytics":{"description":"ถามน้องวิ วิเคราะห์ KPI/forecast/pipeline","inputSchema":{"json":{"type":"object","properties":{"question":{"type":"string"}},"required":["question"]}}},
}

def call_gw(name, args):
    mcp = {"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":GP+name,"arguments":args}}
    req = urllib.request.Request(GATEWAY_URL, data=json.dumps(mcp).encode(), headers={"Content-Type":"application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=25) as r:
        res = json.loads(r.read().decode())
        txt = res.get("result",{}).get("content",[{}])[0].get("text","{}")
        inner = json.loads(txt)
        body = inner.get("body", inner)
        if isinstance(body, str):
            try: return json.loads(body)
            except: return {"text": body}
        return body

def call_a2a(arn, q):
    resp = ac.invoke_agent_runtime(agentRuntimeArn=arn, payload=json.dumps({"message":q}).encode(), contentType="application/json", accept="application/json")
    d = json.loads(resp["response"].read().decode())
    return {"answer": d.get("reply", str(d))}

def run_tool(name, args):
    if name == "ask_sales_assistant": return call_a2a(SALES_ARN, args["question"])
    if name == "ask_analytics": return call_a2a(ANALYTICS_ARN, args["question"])
    return call_gw(name, args)

def sanitize(c):
    out = [b for b in c if not ("text" in b and not b.get("text","").strip())]
    return out if out else [{"text": " "}]

def invoke(message):
    cfg = CONFIGS.get(AGENT_ROLE, CONFIGS["sales-assistant"])
    tool_names = cfg["tools"]
    tools_config = {"tools": [{"toolSpec":{"name":n,"description":ALL_TOOLS[n]["description"],"inputSchema":ALL_TOOLS[n]["inputSchema"]}} for n in tool_names]}
    messages = [{"role":"user","content":[{"text":message}]}]
    for _ in range(6):
        resp = bedrock.converse(modelId=MODEL_ID, system=[{"text":cfg["system"]}], messages=messages, toolConfig=tools_config, inferenceConfig={"maxTokens":2048,"temperature":0.3})
        out = resp["output"]["message"]
        out["content"] = sanitize(out["content"])
        messages.append(out)
        tus = [b for b in out["content"] if "toolUse" in b]
        if not tus:
            return "\n".join(b["text"] for b in out["content"] if "text" in b and b["text"])
        results = []
        for tu in tus:
            t = tu["toolUse"]
            try:
                r = run_tool(t["name"], t["input"])
                if not isinstance(r, dict): r = {"data": r}
                results.append({"toolResult":{"toolUseId":t["toolUseId"],"content":[{"json":r}]}})
            except Exception as e:
                results.append({"toolResult":{"toolUseId":t["toolUseId"],"content":[{"text":str(e)}],"status":"error"}})
        messages.append({"role":"user","content":results})
    return "ขออภัยค่ะ ไม่สามารถประมวลผลได้"

class H(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path=="/ping": self.send_response(200);self.send_header("Content-Type","application/json");self.end_headers();self.wfile.write(b'{"status":"Healthy"}')
        else: self.send_response(404);self.end_headers()
    def do_POST(self):
        if self.path=="/invocations":
            body=self.rfile.read(int(self.headers.get("Content-Length",0)))
            try: p=json.loads(body)
            except: p={"message":body.decode()}
            msg=p.get("message",p.get("prompt",str(p)))
            cfg=CONFIGS.get(AGENT_ROLE,CONFIGS["sales-assistant"])
            try: reply=invoke(msg);out=json.dumps({"reply":reply,"agentUsed":cfg["name"],"via":"AgentCore Gateway"},ensure_ascii=False)
            except Exception as e: print(f"[ERR]{traceback.format_exc()}");out=json.dumps({"reply":f"ขออภัยค่ะ: {e}","error":str(e),"agentUsed":cfg["name"]},ensure_ascii=False)
            self.send_response(200);self.send_header("Content-Type","application/json");self.end_headers();self.wfile.write(out.encode())
        else: self.send_response(404);self.end_headers()
    def log_message(self,*a): pass

if __name__=="__main__":
    cfg=CONFIGS.get(AGENT_ROLE,CONFIGS["sales-assistant"])
    print(f"[{cfg['name']}] role={AGENT_ROLE} port={PORT} model={MODEL_ID}");HTTPServer(("0.0.0.0",PORT),H).serve_forever()
