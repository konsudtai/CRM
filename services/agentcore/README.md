# SalesFAST 7 — AgentCore Runtime

Multi-agent AI service hosted on Amazon Bedrock AgentCore Runtime.

## Agents
- **น้องแอ๊ด** (admin) — ตอบลูกค้า, เก็บ Lead
- **น้องขายไว** (sales-assistant) — ช่วยทีมขาย
- **น้องวิ** (analytics) — วิเคราะห์ข้อมูล

## Build & Deploy

```bash
cd services/agentcore
npm install
npm run build
npm run package
```

This creates `agent.zip` ready for AgentCore deployment.

## Deploy to AgentCore

### Option 1: AWS Console
1. Go to Amazon Bedrock → AgentCore → Create Agent Runtime
2. Name: `sf7-agents`
3. Runtime: `NODE_22`
4. Upload: `agent.zip`
5. Entry point: `dist/app.js`
6. Environment variables:
   - `AWS_BEARER_TOKEN_BEDROCK` = your Bedrock API Key
   - `BEDROCK_MODEL_ID` = `global.anthropic.claude-sonnet-4-6`
   - `BEDROCK_REGION` = `ap-southeast-1`

### Option 2: AgentCore CLI
```bash
npm install -g @aws/agentcore-cli
agentcore deploy --name sf7-agents --runtime NODE_22 --zip agent.zip --entry dist/app.js
```

## Invoke

```bash
# JSON response
curl -X POST https://<agent-runtime-url>/invocations \
  -H "Content-Type: application/json" \
  -d '{"message":"สวัสดีครับ","agentType":"admin"}'

# SSE Streaming
curl -X POST https://<agent-runtime-url>/invocations \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"message":"สวัสดีครับ","agentType":"admin"}'
```

## Frontend Integration

After deployment, update frontend to point to AgentCore endpoint:
- Landing page (น้องแอ๊ด): `frontend/landing.html`
- CRM app (น้องขายไว): `frontend/js/nav.js`
- Dashboard (น้องวิ): `frontend/app/dashboard.html`
