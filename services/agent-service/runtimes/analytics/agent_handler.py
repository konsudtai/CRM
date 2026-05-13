"""น้องวิ — Analytics Runtime"""
import json, os, traceback, boto3, urllib.request, urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8080"))
REGION = os.environ.get("BEDROCK_REGION", "ap-southeast-1")
MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "global.anthropic.claude-sonnet-4-6")
GATEWAY_URL = os.environ.get("GATEWAY_URL", "https://sf7-crm-gateway-zd795zpjtz.gateway.bedrock-agentcore.ap-southeast-1.amazonaws.com/mcp")
SALES_RUNTIME_ARN = os.environ.get("SALES_RUNTIME_ARN", "")

bedrock = boto3.client("bedrock-runtime", region_name=REGION)
agentcore = boto3.client("bedrock-agentcore", region_name=REGION)

GATEWAY_PREFIX = "sf7-crm-tools___"
SYSTEM = """คุณเป็นนักวิเคราะห์ข้อมูลการขาย ชื่อ "น้องวิ" ตอบภาษาไทย ใช้ค่ะ
ใช้ตัวเลขจริงจาก tools เสมอ ห้ามสมมติ ใช้ emoji (📈📉⚠️✅🎯)
จบด้วยคำแนะนำ action 1-3 ข้อเสมอ ใช้ tenantId=default
ถ้าต้องการข้อมูล CRM เพิ่ม ให้ใช้ ask_sales_assistant"""

TOOLS = [
    {"name":"get_kpi_summary","description":"ดึง KPI สรุป","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"period":{"type":"string"}},"required":["tenantId"]}}},
    {"name":"get_pipeline_analysis","description":"วิเคราะห์ pipeline","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"}},"required":["tenantId"]}}},
    {"name":"get_revenue_data","description":"ดึง revenue รายเดือน","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"year":{"type":"number"}},"required":["tenantId"]}}},
    {"name":"get_forecast","description":"พยากรณ์ revenue","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"}},"required":["tenantId"]}}},
    {"name":"search_opportunities","description":"ค้นหา Deal","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"stage":{"type":"string"}},"required":["tenantId"]}}},
    {"name":"get_users","description":"ดึงรายชื่อ Users","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"}},"required":["tenantId"]}}},
    {"name":"ask_sales_assistant","description":"ถามน้องขายไว ข้อมูล CRM เช่น Lead, Account, Task","inputSchema":{"json":{"type":"object","properties":{"question":{"type":"string"}},"required":["question"]}}},
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
    if name == "ask_sales_assistant":
        r = call_a2a(SALES_RUNTIME_ARN, args["question"])
        return {"answer": r.get("reply", str(r))}
    return call_gateway(name, args)

def sanitize(content):
    out = [b for b in content if not ("text" in b and not b["text"].strip())]
    return out if out else [{"text": " "}]

def invoke(message):
    tools_config = {"tools": [{"toolSpec": {"name":t["name"],"description":t["description"],"inputSchema":t["inputSchema"]}} for t in TOOLS]}
    messages = [{"role":"user","content":[{"text":message}]}]
    for _ in range(5):
        resp = bedrock.converse(modelId=MODEL_ID, system=[{"text":SYSTEM}], messages=messages, toolConfig=tools_config, inferenceConfig={"maxTokens":2048,"temperature":0.2})
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
            try: reply=invoke(msg);out=json.dumps({"reply":reply,"agentUsed":"น้องวิ","via":"AgentCore Gateway"},ensure_ascii=False)
            except Exception as e: print(f"[ERR]{traceback.format_exc()}");out=json.dumps({"reply":f"ขออภัยค่ะ: {e}","error":str(e)},ensure_ascii=False)
            self.send_response(200);self.send_header("Content-Type","application/json");self.end_headers();self.wfile.write(out.encode())
        else: self.send_response(404);self.end_headers()
    def log_message(self,*a): pass

if __name__=="__main__":
    print(f"[น้องวิ] port={PORT} model={MODEL_ID}");HTTPServer(("0.0.0.0",PORT),H).serve_forever()
