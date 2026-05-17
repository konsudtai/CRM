"""
SalesFAST 7 — Analytics Agent (น้องวิ)
HTTP server for AgentCore Runtime: /ping + /invocations on port 8080
"""
import json
import os
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler

_agent = None


def get_agent():
    global _agent
    if _agent is None:
        from agent import build_agent
        _agent = build_agent()
    return _agent


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, body, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print(f"[{self.address_string()}] {fmt % args}", flush=True)

    def do_GET(self):
        if self.path == "/ping":
            self._send(200, b'{"status":"ok","agent":"analytics"}')
        else:
            self._send(404, b'{"error":"not found"}')

    def do_POST(self):
        if self.path != "/invocations":
            self._send(404, b'{"error":"not found"}')
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            payload = json.loads(body) if body else {}

            message = payload.get("message", payload.get("input", "")).strip()
            session_id = payload.get("sessionId", "default")
            actor_id = payload.get("actorId", "default")
            tenant_id = payload.get("tenantId", "default")

            if not message:
                self._send(400, b'{"error":"message required"}')
                return

            print(f"[INVOKE] sid={session_id} actor={actor_id} msg={message[:80]}", flush=True)

            agent = get_agent()
            reply = agent.run(
                message=message,
                session_id=session_id,
                actor_id=actor_id,
                tenant_id=tenant_id,
            )

            response = {
                "reply": reply,
                "agent": "analytics",
                "agentName": "น้องวิ",
            }
            self._send(200, json.dumps(response, ensure_ascii=False).encode("utf-8"))

        except Exception as e:
            print(f"[ERROR] {e}", flush=True)
            print(traceback.format_exc(), flush=True)
            err = {"error": str(e), "trace": traceback.format_exc()[:500]}
            self._send(500, json.dumps(err, ensure_ascii=False).encode("utf-8"))


def main():
    port = int(os.environ.get("PORT", "8080"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"[analytics-agent] listening on 0.0.0.0:{port}", flush=True)

    try:
        get_agent()
        print("[analytics-agent] agent ready", flush=True)
    except Exception as e:
        print(f"[analytics-agent] WARN: pre-warm failed — {e}", flush=True)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
