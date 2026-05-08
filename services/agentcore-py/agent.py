"""
SalesFAST 7 — AgentCore Runtime Entry Point

Endpoints (required by AgentCore):
  GET  /ping         — Health check
  POST /invocations  — Invoke agent

Features:
  - 3 Agents (น้องแอ๊ด, น้องขายไว, น้องวิ)
  - A2A (Agent-to-Agent) delegation
  - MCP-style CRM tools (direct PostgreSQL)
  - AgentCore Memory for session context
"""
import os
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, Header, Request
from pydantic import BaseModel
import uvicorn

from agents.factory import get_factory, detect_agent_type
from tools.crm_tools import set_tenant

# ── Logging ──
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s: %(message)s')
logger = logging.getLogger('sf7-agentcore')

# ── App ──
app = FastAPI(title='SalesFAST 7 AgentCore Runtime', version='2.0.0')


# ══════════════════════════════════════════════════════════════
# AgentCore Memory integration (optional)
# ══════════════════════════════════════════════════════════════

MEMORY_ID = os.environ.get('AGENTCORE_MEMORY_ID', '')
_memory_client = None


def get_memory_client():
    """Lazy init AgentCore Memory client."""
    global _memory_client
    if _memory_client is None and MEMORY_ID:
        try:
            import boto3
            _memory_client = boto3.client('bedrock-agentcore', region_name=os.environ.get('BEDROCK_REGION', 'ap-southeast-1'))
        except Exception as e:
            logger.warning(f'Memory client init failed: {e}')
    return _memory_client


async def load_session_context(session_id: str) -> str:
    """Load recent conversation from AgentCore Memory."""
    if not MEMORY_ID or not session_id:
        return ''
    client = get_memory_client()
    if not client:
        return ''
    try:
        resp = client.list_events(memoryId=MEMORY_ID, sessionId=session_id, maxResults=10)
        events = resp.get('events', [])
        if not events:
            return ''
        # Format recent events as context
        lines = []
        for ev in events[-5:]:  # last 5 turns
            payload = ev.get('payload', [])
            for item in payload:
                if 'conversational' in item:
                    role = item['conversational'].get('role', '')
                    content = item['conversational'].get('content', {}).get('text', '')
                    if content:
                        lines.append(f'{role}: {content[:200]}')
        return '\n'.join(lines)
    except Exception as e:
        logger.warning(f'load_session_context failed: {e}')
        return ''


async def save_turn(session_id: str, user_message: str, assistant_reply: str) -> None:
    """Save conversation turn to AgentCore Memory."""
    if not MEMORY_ID or not session_id:
        return
    client = get_memory_client()
    if not client:
        return
    try:
        client.create_event(
            memoryId=MEMORY_ID,
            actorId='user',
            sessionId=session_id,
            eventTimestamp=datetime.utcnow(),
            payload=[
                {'conversational': {'role': 'USER', 'content': {'text': user_message}}},
                {'conversational': {'role': 'ASSISTANT', 'content': {'text': assistant_reply}}},
            ],
        )
    except Exception as e:
        logger.warning(f'save_turn failed: {e}')


# ══════════════════════════════════════════════════════════════
# Models
# ══════════════════════════════════════════════════════════════

class InvocationRequest(BaseModel):
    # AgentCore standard format: {"input": {...}}
    input: Optional[Dict[str, Any]] = None
    # Direct flat format (for frontend compatibility)
    prompt: Optional[str] = None
    message: Optional[str] = None
    agentType: Optional[str] = None
    tenantId: Optional[str] = None
    sessionId: Optional[str] = None

    def get_message(self) -> str:
        if self.input:
            return self.input.get('prompt') or self.input.get('message') or ''
        return self.prompt or self.message or ''

    def get_agent_type(self) -> str:
        if self.input:
            return self.input.get('agentType') or self.input.get('agent_type') or 'auto'
        return self.agentType or 'auto'

    def get_tenant_id(self) -> str:
        if self.input:
            return self.input.get('tenantId') or self.input.get('tenant_id') or '00000000-0000-0000-0000-000000000001'
        return self.tenantId or '00000000-0000-0000-0000-000000000001'

    def get_session_id(self) -> str:
        if self.input:
            return self.input.get('sessionId') or self.input.get('session_id') or ''
        return self.sessionId or ''


class InvocationResponse(BaseModel):
    output: Dict[str, Any]


# ══════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════

@app.get('/ping')
async def ping() -> Dict[str, Any]:
    """Health check (required by AgentCore)."""
    return {
        'status': 'Healthy',
        'agents': ['admin', 'sales-assistant', 'analytics'],
        'features': ['a2a', 'mcp', 'memory'],
        'memory_enabled': bool(MEMORY_ID),
    }


@app.post('/invocations')
async def invocations(
    request: Request,
    mcp_session_id: Optional[str] = Header(None, alias='Mcp-Session-Id'),
    runtime_session_id: Optional[str] = Header(None, alias='X-Amzn-Bedrock-AgentCore-Runtime-Session-Id'),
) -> Dict[str, Any]:
    """Invoke agent (required by AgentCore).

    Accepts multiple payload formats:
      - {"message": "...", "agentType": "...", "tenantId": "..."}
      - {"prompt": "...", ...}
      - {"input": {"message": "..."}}
    """
    try:
        # Parse body defensively — AgentCore may send raw bytes
        body_bytes = await request.body()
        logger.info(f'Received {len(body_bytes)} bytes, headers: {dict(request.headers)}')

        if not body_bytes:
            raise HTTPException(status_code=400, detail='Empty body')

        try:
            import json as _json
            data = _json.loads(body_bytes.decode('utf-8'))
        except Exception as e:
            logger.error(f'JSON parse error: {e}, body={body_bytes[:200]}')
            raise HTTPException(status_code=400, detail=f'Invalid JSON: {e}')

        # Normalize — support both flat and nested {"input": {...}} formats
        if isinstance(data.get('input'), dict):
            payload = data['input']
        else:
            payload = data

        user_message = payload.get('prompt') or payload.get('message') or ''
        if not user_message:
            raise HTTPException(status_code=400, detail='No message provided (expected "message" or "prompt")')

        agent_type = payload.get('agentType') or payload.get('agent_type') or 'auto'
        tenant_id = payload.get('tenantId') or payload.get('tenant_id') or '00000000-0000-0000-0000-000000000001'
        session_id = payload.get('sessionId') or payload.get('session_id') or runtime_session_id or mcp_session_id or ''

        # Set tenant context for tools
        set_tenant(tenant_id)

        # Auto-route
        if agent_type == 'auto' or not agent_type:
            agent_type = detect_agent_type(user_message)

        # Load session context from AgentCore Memory (if enabled)
        context = ''
        if session_id:
            context = await load_session_context(session_id)

        full_message = user_message
        if context:
            full_message = f'[Previous conversation:\n{context}]\n\n{user_message}'

        # Invoke agent
        logger.info(f'Invoking agent={agent_type} tenant={tenant_id} session={session_id[:8] if session_id else "none"}')
        factory = get_factory()
        agent = factory.get(agent_type)
        result = agent(full_message)

        reply = str(result.message) if hasattr(result, 'message') else str(result)

        if session_id:
            await save_turn(session_id, user_message, reply)

        agent_name = {
            'admin': 'น้องแอ๊ด',
            'analytics': 'น้องวิ',
            'sales-assistant': 'น้องขายไว',
        }.get(agent_type, 'น้องขายไว')

        return {
            'output': {
                'reply': reply,
                'agentUsed': agent_name,
                'agentType': agent_type,
                'sessionId': session_id,
                'timestamp': datetime.utcnow().isoformat(),
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception('Agent invocation failed')
        raise HTTPException(status_code=500, detail=f'Agent processing failed: {str(e)[:200]}')


# ══════════════════════════════════════════════════════════════
# Entry point
# ══════════════════════════════════════════════════════════════

if __name__ == '__main__':
    port = int(os.environ.get('PORT', '8080'))
    logger.info('═══════════════════════════════════════════════════')
    logger.info('  SalesFAST 7 — AgentCore Runtime (Python)')
    logger.info(f'  Port: {port}')
    logger.info(f'  Model: {os.environ.get("BEDROCK_MODEL_ID", "default")}')
    logger.info(f'  Region: {os.environ.get("BEDROCK_REGION", "ap-southeast-1")}')
    logger.info(f'  Memory: {"enabled" if MEMORY_ID else "disabled"}')
    logger.info('═══════════════════════════════════════════════════')
    uvicorn.run(app, host='0.0.0.0', port=port)
