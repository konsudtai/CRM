import boto3, json, uuid
c = boto3.client('bedrock-agentcore', region_name='ap-southeast-1')

sid = 'sf7-test-' + str(uuid.uuid4())
print(f'Session: {sid}')
try:
    resp = c.invoke_agent_runtime(
        agentRuntimeArn='arn:aws:bedrock-agentcore:ap-southeast-1:364478544994:runtime/sf7_analytics-AY5sRH2Qtv',
        runtimeSessionId=sid,
        payload=json.dumps({'message':'forecast','tenantId':'default','sessionId':sid}).encode(),
        contentType='application/json',
        accept='application/json',
    )
    body = resp['response'].read().decode()
    print('Response:', body[:500])
except Exception as e:
    print(f'Error: {e}')
