"""น้องแอ๊ด — Admin AI Runtime with AgentCore Memory"""
import json, os, traceback, boto3, urllib.request, urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8080"))
REGION = os.environ.get("BEDROCK_REGION", "ap-southeast-1")
MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "global.anthropic.claude-sonnet-4-6")
GATEWAY_URL = os.environ.get("GATEWAY_URL", "https://sf7-crm-gateway-zd795zpjtz.gateway.bedrock-agentcore.ap-southeast-1.amazonaws.com/mcp")
SALES_RUNTIME_ARN = os.environ.get("SALES_RUNTIME_ARN", "")
MEMORY_ID = os.environ.get("MEMORY_ID", "sf7_agents_memory-Ye8E3AGtiH")

bedrock = boto3.client("bedrock-runtime", region_name=REGION)
agentcore = boto3.client("bedrock-agentcore", region_name=REGION)
memory_client = boto3.client("bedrock-agentcore", region_name=REGION)

GATEWAY_PREFIX = "sf7-crm-tools___"
SYSTEM = """คุณเป็นผู้ช่วยฝ่ายขาย ชื่อ "น้องแอ๊ด" ตอบภาษาไทย สุภาพ ใช้ค่ะ
คุณทำหน้าที่รับลูกค้าใหม่ผ่าน LINE OA และเก็บข้อมูลเข้าระบบ CRM

Flow การสนทนา (ทำตามลำดับนี้):

1. แนะนำตัว:
   - ทักทาย แนะนำว่าเป็นน้องแอ๊ด ผู้ช่วยฝ่ายขาย
   - ถามว่าสนใจสินค้า/บริการอะไร

2. แนะนำสินค้า:
   - เมื่อลูกค้าบอกสิ่งที่สนใจ → ใช้ search_products ค้นหา
   - แสดงสินค้าที่เกี่ยวข้อง (ชื่อ + ราคา + รายละเอียดสั้นๆ)
   - ถามว่าสนใจตัวไหน หรือต้องการข้อมูลเพิ่มเติม

3. เก็บข้อมูลบริษัท (ถามทีละข้อ เป็นกันเอง):
   - ชื่อบริษัท
   - ประเภทธุรกิจ
   - ที่อยู่ (ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์)
   - เลขผู้เสียภาษี (ถ้ามี ไม่บังคับ)

4. เก็บข้อมูลผู้ติดต่อ:
   - ชื่อ-นามสกุล
   - ตำแหน่ง
   - เบอร์โทร
   - อีเมล

5. สร้าง Lead ในระบบ:
   - เมื่อได้ข้อมูลครบ → ใช้ create_lead สร้าง Lead
   - notes ให้ใส่: สินค้าที่สนใจ + ข้อมูลบริษัท + ที่อยู่
   - แจ้งลูกค้าว่า "ทีมงานจะติดต่อกลับภายใน 24 ชม."
   - ใช้ ask_sales_assistant แจ้งน้องขายไวว่ามี Lead ใหม่

6. เมื่อ Lead ถูก assign:
   - ถ้าน้องขายไวแจ้งกลับมาว่า assign ให้ใครแล้ว
   - แจ้งลูกค้าผ่าน LINE ว่า "คุณ [ชื่อ Sales Rep] จะเป็นผู้ดูแลท่านค่ะ"

การจับสัญญาณความสนใจ:
- ถ้าลูกค้าพูดอะไรก็ตามที่แสดงความสนใจ เช่น "น่าสนใจ", "อยากได้", "ราคาเท่าไหร่", "มีรุ่นไหนบ้าง", "ส่งข้อมูลให้หน่อย", "ขอรายละเอียด" → ถือว่าสนใจ → เริ่มถามข้อมูลบริษัททันที
- ไม่ต้องรอให้ลูกค้าพูดว่า "สนใจ" ตรงๆ ถ้าถามเรื่องสินค้าหรือราคา = สนใจแล้ว
- หลังตอบคำถามสินค้าแล้ว ให้ถามต่อทันทีว่า "สะดวกให้ข้อมูลเพื่อให้ทีมงานติดต่อกลับไหมคะ? ขอทราบชื่อบริษัทค่ะ"

หลักการสำคัญ:
- ถามทีละ 1-2 คำถาม ไม่ถามทีเดียวหมด
- ถ้าลูกค้าตอบหลายอย่างพร้อมกัน จับข้อมูลทั้งหมด แล้วถามเฉพาะที่ยังขาด
- ถ้าลูกค้าถามเรื่องสินค้า/ราคา ตอบก่อนแล้วค่อยกลับมาเก็บข้อมูล
- เป็นกันเอง ไม่เหมือนกรอกฟอร์ม ใช้ภาษาสบายๆ
- ห้ามใช้ markdown formatting เช่น ** หรือ ##
- ห้ามให้ส่วนลดหรือสัญญาอะไรที่ไม่ได้รับอนุญาต
- ใช้ tenantId=default"""

TOOLS = [
    {"name":"search_products","description":"ค้นหาสินค้า/ราคา","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"search":{"type":"string"},"category":{"type":"string"}},"required":["tenantId"]}}},
    {"name":"create_lead","description":"สร้าง Lead เมื่อได้ข้อมูลลูกค้าครบ","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"name":{"type":"string","description":"ชื่อผู้ติดต่อ"},"companyName":{"type":"string","description":"ชื่อบริษัท"},"phone":{"type":"string"},"email":{"type":"string"},"source":{"type":"string","description":"แหล่งที่มา เช่น LINE"},"notes":{"type":"string","description":"สินค้าที่สนใจ + ข้อมูลบริษัท + ที่อยู่"}},"required":["tenantId","name"]}}},
    {"name":"search_accounts","description":"เช็คว่าเป็นลูกค้าเดิมไหม","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"search":{"type":"string"}},"required":["tenantId","search"]}}},
    {"name":"get_users","description":"ดึงรายชื่อ Sales Reps","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"}},"required":["tenantId"]}}},
    {"name":"send_notification","description":"แจ้ง Sales Rep หรือ Manager","inputSchema":{"json":{"type":"object","properties":{"tenantId":{"type":"string"},"userId":{"type":"string"},"type":{"type":"string"},"title":{"type":"string"},"body":{"type":"string"}},"required":["tenantId","userId","type","title","body"]}}},
    {"name":"ask_sales_assistant","description":"ถามน้องขายไว เช่น แจ้ง Lead ใหม่ หรือถามข้อมูล CRM","inputSchema":{"json":{"type":"object","properties":{"question":{"type":"string"}},"required":["question"]}}},
]

# ── AgentCore Memory ──
def get_memory_history(session_id, actor_id):
    """Retrieve conversation history from AgentCore Memory"""
    try:
        resp = memory_client.list_events(
            memoryId=MEMORY_ID,
            sessionId=session_id,
            actorId=actor_id,
            includePayloads=True
        )
        events = resp.get("events", [])
        messages = []
        for ev in events:
            role = ev.get("payload",[{}])[0].get("conversational",{}).get("role","USER").lower()
            content = ev.get("payload",[{}])[0].get("conversational",{}).get("content",{}).get("text","")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": [{"text": content}]})
        return messages
    except Exception as e:
        print(f"[Memory] Get error: {e}")
        return []

def save_memory_event(session_id, actor_id, role, content):
    """Save a message to AgentCore Memory"""
    try:
        memory_client.create_event(
            memoryId=MEMORY_ID,
            sessionId=session_id,
            actorId=actor_id,
            eventTimestamp=__import__("datetime").datetime.now(),payload=[{"conversational":{"content":{"text":content},"role":role.upper()}}]
        )
    except Exception as e:
        print(f"[Memory] Save error: {e}")

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

def invoke(message, session_id="default", actor_id="anonymous"):
    tools_config = {"tools": [{"toolSpec": {"name":t["name"],"description":t["description"],"inputSchema":t["inputSchema"]}} for t in TOOLS]}
    
    # Load conversation history from AgentCore Memory
    messages = get_memory_history(session_id, actor_id)
    messages.append({"role":"user","content":[{"text":message}]})
    
    # Save user message to memory
    save_memory_event(session_id, actor_id, "user", message)
    
    for _ in range(5):
        resp = bedrock.converse(modelId=MODEL_ID, system=[{"text":SYSTEM}], messages=messages, toolConfig=tools_config, inferenceConfig={"maxTokens":2048,"temperature":0.4})
        output = resp["output"]["message"]
        output["content"] = sanitize(output["content"])
        messages.append(output)
        tool_uses = [b for b in output["content"] if "toolUse" in b]
        if not tool_uses:
            reply = "\n".join(b["text"] for b in output["content"] if "text" in b and b["text"])
            # Save assistant reply to memory
            save_memory_event(session_id, actor_id, "assistant", reply)
            return reply
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
    reply = "ขออภัยค่ะ ไม่สามารถประมวลผลได้"
    save_memory_event(session_id, actor_id, "assistant", reply)
    return reply

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
            session_id=p.get("sessionId","default")
            actor_id=p.get("lineUserId",p.get("actorId","anonymous"))
            try: reply=invoke(msg, session_id, actor_id);out=json.dumps({"reply":reply,"agentUsed":"น้องแอ๊ด","via":"AgentCore Memory"},ensure_ascii=False)
            except Exception as e: print(f"[ERR]{traceback.format_exc()}");out=json.dumps({"reply":f"ขออภัยค่ะ: {e}","error":str(e)},ensure_ascii=False)
            self.send_response(200);self.send_header("Content-Type","application/json");self.end_headers();self.wfile.write(out.encode())
        else: self.send_response(404);self.end_headers()
    def log_message(self,*a): pass

if __name__=="__main__":
    print(f"[น้องแอ๊ด] port={PORT} model={MODEL_ID} memory={MEMORY_ID}");HTTPServer(("0.0.0.0",PORT),H).serve_forever()
