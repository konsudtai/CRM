# SalesFAST 7 — AgentCore Runtime (Python)

Multi-Agent AI on Amazon Bedrock AgentCore Runtime — deploys via **S3 code upload** (no Docker).

## Features

| Feature | Status |
|---------|--------|
| **3 Agents** (น้องแอ๊ด, น้องขายไว, น้องวิ) | ✅ |
| **A2A** (Agent-to-Agent delegation) | ✅ `ask_sales_assistant`, `ask_analytics_agent` |
| **MCP-style tools** (14 CRM tools → PostgreSQL) | ✅ direct psycopg3 |
| **AgentCore Memory** (session context) | ✅ |
| **AgentCore Observability** (traces) | ✅ built-in |
| **Strands Agents SDK** (Python) | ✅ |

## Architecture

```
Frontend (CloudFront)
    ↓
Lambda proxy (/agents/chat)
    ↓ InvokeAgentRuntime (SigV4)
AgentCore Runtime (Python)
    ├── Orchestrator — auto-route by keywords
    ├── น้องแอ๊ด (Admin)      → A2A to sales
    ├── น้องขายไว (Sales)      → A2A to analytics
    └── น้องวิ (Analytics)     → terminal
    ↓
PostgreSQL (RDS) via psycopg3
```

## Deploy

### Prerequisites
- Python 3.11+
- `pip install boto3`
- AWS credentials configured
- Bedrock model access enabled (Claude Sonnet)

### One command
```bash
cd services/agentcore-py
python3 deploy.py
```

What it does:
1. Creates IAM role `sf7-agentcore-role`
2. Creates AgentCore Memory resource
3. Creates S3 bucket `sf7-agentcore-code-<account>`
4. Packages code → zip (~30 KB, no deps bundled — AgentCore installs from requirements.txt)
5. Uploads zip to S3
6. Creates/updates AgentCore Runtime with env vars from existing Lambda

### Test locally
```bash
pip install -r requirements.txt
export DB_HOST=your-rds-endpoint
export DB_PASS=your-password
export BEDROCK_MODEL_ID=apac.anthropic.claude-3-5-sonnet-20241022-v2:0
python3 agent.py

# In another terminal:
curl http://localhost:8080/ping
curl -X POST http://localhost:8080/invocations \
  -H "Content-Type: application/json" \
  -d '{"message":"สรุป Lead","agentType":"sales-assistant","tenantId":"default"}'
```

## File structure

```
services/agentcore-py/
├── agent.py              # FastAPI app (/ping, /invocations)
├── agents/
│   ├── factory.py        # Agent creation + A2A wiring
│   └── prompts.py        # System prompts for 3 agents
├── tools/
│   ├── db.py             # psycopg3 connection pool
│   └── crm_tools.py      # 14 CRM tools (@tool decorated)
├── requirements.txt
├── pyproject.toml
└── deploy.py             # S3 code deployment script
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_HOST` | ✅ | RDS endpoint |
| `DB_PASS` | ✅ | Database password |
| `DB_USER` | | Default: salesfast7 |
| `DB_NAME` | | Default: salesfast7 |
| `DB_PORT` | | Default: 5432 |
| `DB_SSL` | | Default: true |
| `BEDROCK_MODEL_ID` | | Default: Claude 3.5 Sonnet |
| `BEDROCK_REGION` | | Default: ap-southeast-1 |
| `AGENTCORE_MEMORY_ID` | | Auto-set by deploy.py |

## MCP Tools

| Tool | Agent | Description |
|------|-------|-------------|
| `get_leads` | All | ค้นหา Leads |
| `get_lead_detail` | All | Lead + Sales Rep |
| `create_lead` | Admin, Sales | สร้าง Lead |
| `update_lead` | Sales | อัพเดท status/assign |
| `get_accounts` | All | ค้นหาลูกค้า |
| `get_account_detail` | All | ลูกค้า + contacts |
| `get_users` | Sales | รายชื่อ Sales Rep |
| `get_tasks` | Sales | ดู Tasks |
| `create_task` | Sales | สร้าง Task |
| `get_products` | All | ค้นหาสินค้า |
| `get_quotations` | Sales | ดู Quotations |
| `get_pipeline_summary` | All | สรุป Pipeline |
| `get_kpi_summary` | All | สรุป KPI |
| `get_sales_rep_performance` | Analytics | ผลงาน Sales Rep |

## A2A Flow Example

```
Customer: "ใครดูแลบริษัท ABC อยู่?"
  ↓
น้องแอ๊ด: detects CRM question → calls ask_sales_assistant("ใครดูแลบริษัท ABC")
  ↓
น้องขายไว (via AgentCore session): calls get_lead_detail(search="ABC")
  ↓
PostgreSQL: returns lead + assigned Sales Rep
  ↓
น้องขายไว: "คุณสมชาย ดูแลค่ะ โทร 08-xxxx-xxxx"
  ↓
น้องแอ๊ด: "คุณติดต่อคุณสมชายได้ที่ 08-xxxx-xxxx นะคะ 😊"
```

## Cost (estimate)

AgentCore Runtime charges only for **active CPU time** (I/O wait is free).

| Usage | Runtime cost | Memory cost | Total |
|-------|--------------|-------------|-------|
| 100 chats/day | ~$0.20/mo | ~$0.05/mo | **~$0.25/mo** |
| 1,000 chats/day | ~$2/mo | ~$0.5/mo | **~$2.5/mo** |

Plus Bedrock model usage (~$15-30 per 1000 Claude 3.5 Sonnet chats).
