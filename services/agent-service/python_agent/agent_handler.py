"""
SalesFAST 7 — Sales Assistant (AgentCore Runtime)
HTTP server with /ping + /invocations endpoints.
Uses Bedrock Converse API directly (lightweight, fast cold start).
"""
import json
import os
import boto3
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8080"))
REGION = os.environ.get("BEDROCK_REGION", os.environ.get("AWS_REGION", "ap-southeast-1"))
MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "global.amazon.nova-2-lite-v1:0")

bedrock = boto3.client("bedrock-runtime", region_name=REGION)

SYSTEM_PROMPT = """คุณเป็น Sales Personal Assistant ชื่อ "น้องขายไว"
ตอบเป็นภาษาไทย สุภาพ ใช้ค่ะ มีความเป็นมิตร ตอบสั้น กระชับ"""


class AgentHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/ping":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "Healthy"}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/invocations":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)

            # Parse input
            try:
                payload = json.loads(body.decode("utf-8"))
            except:
                payload = {"message": body.decode("utf-8")}

            message = payload.get("message", payload.get("prompt", str(payload)))

            # Call Bedrock
            try:
                response = bedrock.converse(
                    modelId=MODEL_ID,
                    system=[{"text": SYSTEM_PROMPT}],
                    messages=[{"role": "user", "content": [{"text": message}]}],
                    inferenceConfig={"maxTokens": 1024, "temperature": 0.4},
                )
                output = response.get("output", {})
                reply = ""
                if "message" in output:
                    for block in output["message"].get("content", []):
                        if "text" in block:
                            reply += block["text"]

                result = json.dumps({"reply": reply, "model": MODEL_ID}, ensure_ascii=False)
            except Exception as e:
                result = json.dumps({"reply": f"ขออภัยค่ะ: {e}", "error": str(e)}, ensure_ascii=False)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(result.encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # Suppress logs


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), AgentHandler)
    print(f"AgentCore Runtime listening on port {PORT}")
    server.serve_forever()
