# SalesFAST 7 — AgentCore Runtime v2

Multi-Agent AI with **A2A** (Agent-to-Agent) + **MCP** (CRM Database) on Amazon Bedrock AgentCore Runtime.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Amazon Bedrock AgentCore Runtime                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Orchestrator (auto-route by keywords)                │   │
│  └──────────┬──────────────┬──────────────┬─────────────┘   │
│             ↓              ↓              ↓                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ น้องแอ๊ด     │  │ น้องขายไว    │  │ น้องวิ       │      │
│  │ (Admin AI)   │  │ (Sales Asst) │  │ (Analytics)  │      │
│  │              │  │              │  │              │      │
│  │ A2A tools:   │  │ A2A tools:   │  │ MCP tools:   │      │
│  │ • ask_sales  │  │ • ask_analyt │  │ • get_leads  │      │
│  │ • ask_analyt │  │              │  │ • get_kpi    │      │
│  │              │  │ MCP tools:   │  │ • pipeline   │      │
│  │ MCP tools:   │  │ • 14 tools   │  │ • etc.       │      │
│  │ • create_lead│  │ (full CRUD)  │  │              │      │
│  │ • get_product│  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│             ↕ A2A ↕              ↕ A2A ↕                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Embedded MCP Client (14 CRM tools)                   │   │
│  │  → PostgreSQL (RDS) direct connection                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Features

| Feature | Description |
|---------|-------------|
| **A2A** | น้องแอ๊ด → น้องขายไว (CRM queries), น้องขายไว → น้องวิ (analytics) |
| **MCP Tools** | 14 tools: leads, accounts, users, tasks, products, quotations, pipeline, KPI |
| **Auto-routing** | Orchestrator detects intent and routes to correct agent |
| **Strands SDK** | Full agent reasoning loop with tool use |
| **AgentCore** | Serverless, pay-per-active-CPU, auto-scale |

## MCP Tools Available

| Tool | Agent | Description |
|------|-------|-------------|
| `get_leads` | All | ค้นหา Leads |
| `get_lead_detail` | All | รายละเอียด Lead + Sales Rep |
| `create_lead` | Admin, Sales | สร้าง Lead ใหม่ |
| `update_lead` | Sales | อัพเดท status/assign |
| `get_accounts` | All | ค้นหาลูกค้า |
| `get_account_detail` | All | รายละเอียดลูกค้า + contacts |
| `get_users` | All | รายชื่อ Sales Reps |
| `get_tasks` | All | ดู Tasks |
| `create_task` | Sales | สร้าง Task |
| `get_products` | All | ค้นหาสินค้า |
| `get_quotations` | All | ดู Quotations |
| `get_pipeline_summary` | All | สรุป Pipeline |
| `get_kpi_summary` | All | สรุป KPI |
| `get_sales_rep_performance` | Analytics | ผลงาน Sales Rep |

## Deploy

### Prerequisites
- Docker (with buildx for ARM64)
- AWS CLI configured
- Bedrock model access enabled (Claude Sonnet)

### Quick Deploy
```bash
cd services/agentcore
bash deploy.sh
```

### Manual Steps
```bash
# 1. Build
npm install
npm run build

# 2. Docker build (ARM64)
docker buildx build --platform linux/arm64 -t sf7-agentcore:latest --load .

# 3. Test locally
docker run -p 8080:8080 \
  -e DB_HOST=your-rds-endpoint \
  -e DB_PASS=your-password \
  -e BEDROCK_MODEL_ID=apac.anthropic.claude-3-5-sonnet-20241022-v2:0 \
  -e BEDROCK_REGION=ap-southeast-1 \
  sf7-agentcore:latest

# 4. Test endpoints
curl http://localhost:8080/ping
curl -X POST http://localhost:8080/invocations \
  -H "Content-Type: application/json" \
  -d '{"message":"สรุป Lead ให้หน่อย","agentType":"sales-assistant","tenantId":"default"}'
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_HOST` | ✅ | RDS endpoint |
| `DB_PASS` | ✅ | Database password |
| `DB_USER` | | Default: salesfast7 |
| `DB_NAME` | | Default: salesfast7 |
| `DB_PORT` | | Default: 5432 |
| `DB_SSL` | | Default: true |
| `BEDROCK_MODEL_ID` | | Default: apac.anthropic.claude-3-5-sonnet-20241022-v2:0 |
| `BEDROCK_REGION` | | Default: ap-southeast-1 |

## A2A Flow Example

```
Customer: "ใครดูแลผมอยู่?"
  ↓
น้องแอ๊ด: detects CRM question → calls ask_sales_assistant tool
  ↓
น้องขายไว: calls get_lead_detail(search: customer_name)
  ↓
PostgreSQL: returns lead + sales rep info
  ↓
น้องขายไว: "Sales Rep คือ สมชาย โทร 08-xxxx-xxxx"
  ↓
น้องแอ๊ด: "คุณมีคุณสมชายดูแลอยู่ค่ะ เบอร์ 08-xxxx-xxxx ค่ะ"
```

## Cost Estimate

| Usage | AgentCore Cost | Bedrock Model Cost |
|-------|---------------|-------------------|
| 100 chats/day | ~$1-3/mo | ~$15-30/mo |
| 1,000 chats/day | ~$10-20/mo | ~$150-300/mo |

*AgentCore charges only for active CPU time. I/O wait (Bedrock API calls) is free.*
