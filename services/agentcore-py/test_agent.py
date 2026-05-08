#!/usr/bin/env python3
"""Quick test script for the deployed AgentCore agent."""
import boto3
import json
import time
import sys
from botocore.config import Config

RUNTIME_ARN = 'arn:aws:bedrock-agentcore:ap-southeast-1:364478544994:runtime/sf7_agents-4r6zsaHvkw'

def test(message: str, agent_type: str = 'sales-assistant', tenant_id: str = 'default') -> None:
    cfg = Config(read_timeout=120, connect_timeout=10, retries={'max_attempts': 1})
    c = boto3.client('bedrock-agentcore', region_name='ap-southeast-1', config=cfg)
    sid = f'test-{agent_type}-{int(time.time())}-abcdefghijklmnopqrstuvwxyz-xyz'
    print(f'\n═══ Testing {agent_type} ═══')
    print(f'Session: {sid} (len {len(sid)})')
    print(f'Message: {message}')
    start = time.time()
    try:
        resp = c.invoke_agent_runtime(
            agentRuntimeArn=RUNTIME_ARN,
            runtimeSessionId=sid,
            payload=json.dumps({
                'message': message,
                'agentType': agent_type,
                'tenantId': tenant_id,
            }).encode('utf-8'),
            qualifier='DEFAULT',
        )
        body = resp['response'].read().decode('utf-8')
        elapsed = time.time() - start
        print(f'Time: {elapsed:.1f}s')
        print(f'Response: {body[:2500]}')
    except Exception as e:
        elapsed = time.time() - start
        print(f'Time: {elapsed:.1f}s')
        print(f'ERROR: {str(e)[:400]}')


if __name__ == '__main__':
    msg = sys.argv[1] if len(sys.argv) > 1 else 'สรุป Lead ให้หน่อย'
    agent = sys.argv[2] if len(sys.argv) > 2 else 'sales-assistant'
    test(msg, agent)
