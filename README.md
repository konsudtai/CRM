# SalesFAST 7 — Agentic AI CRM Platform

**Thai SMB CRM with Multi-Agent AI** | Bilingual (TH/EN) | Serverless on AWS

![SalesFAST 7](2pcrm%20logo.png)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND                                        │
├──────────────┬──────────────────┬──────────────────┬────────────────────┤
│ Landing Page │   CRM App        │   Dashboard      │   Admin Portal     │
│ (น้องแอ๊ด)    │  (น้องขายไว)      │  (น้องวิ)        │   (Settings)       │
│ lead capture │  sales workflow   │  analytics       │   user/role mgmt   │
└──────┬───────┴────────┬─────────┴────────┬─────────┴──────────┬────────┘
       │                │                  │                    │
       ▼                ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    AWS CLOUDFRONT (CDN + WAF)                             │
│  Static: S3 bucket  │  API: /auth /leads /accounts /dashboard /agents   │
└──────────────────────┼──────────────────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    API GATEWAY (HTTP API v2)                              │
├─────────────────────────────────────────────────────────────────────────┤
│  /auth/*  /users/*     → sf7-prod-auth (NestJS)                          │
│  /leads/* /accounts/*  → sf7-prod-crm  (Hono)                           │
│  /tasks/* /products/*  → sf7-prod-crm  (Hono)                           │
│  /dashboard/*          → sf7-prod-crm  (Hono)                           │
│  /quotations/*         → sf7-prod-crm  (Hono)                           │
│  /agents/*             → sf7-prod-crm  (Hono + Bedrock)                 │
└─────────────────────────┬───────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    LAMBDA FUNCTIONS (Node.js 20)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  sf7-prod-auth   │ NestJS: login, JWT, users, roles, MFA, SSO           │
│  sf7-prod-crm    │ Hono: leads, accounts, tasks, products, quotations,  │
│                  │       dashboard, agents (AI), pipeline, activities    │
│  sf7-prod-sales  │ Hono: opportunities, pipeline stages                 │
│  sf7-prod-agent  │ (Planned: AgentCore Runtime)                         │
└─────────┬────────┴──────────────────────────────────────────────────────┘
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                             │
├─────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL (RDS)     │ All CRM data, multi-tenant with RLS              │
│  DynamoDB             │ AI chat history, session state                    │
│  S3                   │ Frontend, files, Knowledge Base documents         │
│  SQS + SNS           │ Event-driven: lead.created, task.overdue, etc.    │
└─────────────────────────────────────────────────────────────────────────┘
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    AI LAYER (Amazon Bedrock)                              │
├─────────────────────────────────────────────────────────────────────────┤
│  Model: Claude Sonnet 4.6 (global inference profile)                     │
│  Auth: Bedrock API Key (cross-account)                                   │
│  Knowledge Base: S3 → Titan Embeddings → pgvector/OpenSearch             │
│  Framework: Strands Agents SDK (planned AgentCore migration)             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🤖 Multi-Agent AI System

### Agent Overview

| Agent | Name | Role | Location | Model |
|-------|------|------|----------|-------|
| 🔵 | **น้องแอ๊ด** (Admin AI) | ต้อนรับลูกค้า, เก็บ Lead | Landing Page | Claude Sonnet 4.6 |
| 🟣 | **น้องขายไว** (Sales Assistant) | ช่วยทีมขาย, จัดการ CRM | CRM App (ทุกหน้า) | Claude Sonnet 4.6 |
| 🟢 | **น้องวิ** (Analytics) | วิเคราะห์ข้อมูลการขาย | Dashboard | Claude Sonnet 4.6 |

### Agent Communication Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Agent-to-Agent (A2A)                          │
│                                                               │
│  น้องแอ๊ด ←── A2A ──→ น้องขายไว ←── A2A ──→ น้องวิ            │
│  (ask_sales_assistant)  (ask_analytics_agent)                │
│                                                               │
│  ใช้เมื่อ: ต้องการ reasoning, delegation, multi-step workflow │
├─────────────────────────────────────────────────────────────┤
│                 Agent-to-System (MCP)                         │
│                                                               │
│  ทุก Agent ──── MCP Protocol ────→ CRM MCP Server            │
│                                                               │
│  ใช้เมื่อ: ต้องการ data ตรงๆ จาก DB (เร็ว, 1 hop)            │
│                                                               │
│  Tools: get_leads, get_accounts, get_users, get_tasks,       │
│         get_quotations, get_pipeline_summary, get_kpi,       │
│         create_lead, update_lead, create_task, get_products  │
├─────────────────────────────────────────────────────────────┤
│                 Data Layer                                    │
│                                                               │
│  PostgreSQL (RDS) ← CRM data (real-time)                     │
│  S3 Knowledge Base ← Products, FAQ, Pricing (documents)      │
└─────────────────────────────────────────────────────────────┘
```

### Agent Journeys

#### น้องแอ๊ด — Customer-Facing Lead Capture

```
ลูกค้าเข้า Landing Page
    │
    ▼ กดเปิด Chat Widget
    │
น้องแอ๊ด: "สวัสดีค่ะ! สนใจสินค้าหรือบริการอะไรเป็นพิเศษคะ?"
    │
    ▼ ลูกค้าถามเรื่องสินค้า
    │
น้องแอ๊ด: [ค้นหาจาก Knowledge Base] → ตอบข้อมูลสินค้า + ราคา
    │
    ▼ ค่อยๆ เก็บข้อมูล Lead (ชื่อ, เบอร์, บริษัท, สนใจอะไร, งบ)
    │
น้องแอ๊ด: [A2A → น้องขายไว] "ช่วยสร้าง Lead ให้หน่อย"
    │
    ▼ Lead ถูกสร้างใน Pipeline → Event: lead.created
    │
น้องขายไว: [Auto] Score Lead + แจ้ง Manager + แนะนำ assign
```

#### น้องขายไว — Sales Team Assistant

```
Sales Rep เปิด CRM App
    │
    ▼ พิมพ์: "สรุปงานวันนี้"
    │
น้องขายไว: [MCP → get_tasks, get_leads]
    │  • Task เกินกำหนด: 2 รายการ
    │  • Lead ใหม่รอ follow-up: 1 รายการ
    │  • QT รออนุมัติ: 1 รายการ
    │  💡 แนะนำ: ติดต่อ Lead "ABC" ก่อน (High priority)
    │
    ▼ Sales Rep: "ช่วยเขียน email follow-up ให้ ABC"
    │
น้องขายไว: [Draft email] → แสดง email พร้อมส่ง
    │
    ▼ Manager: "assign lead XYZ ให้ สมชาย"
    │
น้องขายไว: [MCP → update_lead] → assign + สร้าง Task + แจ้ง สมชาย
```

#### น้องวิ — Analytics & Insights

```
Manager เปิด Dashboard
    │
    ▼ พิมพ์: "Forecast เดือนหน้า"
    │
น้องวิ: [MCP → get_kpi, get_pipeline_summary]
    │  📈 Forecast เดือนหน้า: ฿8.5M
    │  • Pipeline ปัจจุบัน: ฿12M (weighted: ฿7.2M)
    │  • Win rate เฉลี่ย: 35%
    │  • Deals ใกล้ปิด: 3 รายการ (฿5.2M)
    │  ⚠️ Risk: Deal "DEF" stuck 15 วัน ใน Negotiation
    │  💡 แนะนำ: Focus ปิด Deal "DEF" + "GHI" ภายในสัปดาห์นี้
    │
    ▼ Manager: "เปรียบเทียบทีม"
    │
น้องวิ: [MCP → get_sales_rep_performance]
    │  🏆 Top: สมชาย (฿3.2M, 5 deals, 45% win rate)
    │  📉 Need coaching: สมหญิง (฿800K, 2 deals, 20% win rate)
```

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML/CSS/JS, Tailwind (Next.js app planned) |
| **API** | Hono (unified Lambda), NestJS (auth service) |
| **Database** | PostgreSQL 16 (RDS), multi-tenant with RLS |
| **AI Model** | Claude Sonnet 4.6 via Amazon Bedrock |
| **AI Framework** | Strands Agents SDK |
| **Agent Communication** | A2A (agent-to-agent) + MCP (agent-to-system) |
| **Knowledge Base** | S3 + Titan Embeddings + pgvector |
| **Infrastructure** | AWS Lambda, API Gateway, CloudFront, S3, SQS, SNS |
| **IaC** | CloudFormation |
| **Auth** | JWT + bcrypt, MFA (TOTP), SSO (Google/Microsoft) |

---

## 🗂️ Project Structure

```
├── frontend/              # Static frontend (HTML/CSS/JS)
│   ├── app/               # CRM pages (dashboard, leads, accounts, etc.)
│   ├── js/                # Shared JS (nav, data loaders, i18n)
│   ├── css/               # Global styles
│   ├── img/               # Agent avatars, logos
│   └── landing.html       # Public landing page (น้องแอ๊ด chat)
├── services/
│   ├── api/               # Unified Hono API (Lambda)
│   │   └── src/routes/    # leads, accounts, tasks, products, quotations,
│   │                      # dashboard, agents, opportunities, activities
│   ├── auth-service/      # NestJS auth (login, users, roles, MFA)
│   ├── agent-service/     # Strands Agents SDK (full implementation)
│   ├── agentcore/         # AgentCore Runtime package (planned)
│   ├── crm-mcp-server/    # MCP Server for CRM database
│   ├── crm-service/       # NestJS CRM (accounts, contacts)
│   └── sales-service/     # NestJS Sales (opportunities, targets)
├── packages/
│   ├── shared-types/      # TypeScript types
│   ├── ui-components/     # React components (Next.js app)
│   └── utils/             # Thai localization utilities
├── apps/
│   └── web-crm/           # Next.js CRM app (planned migration)
├── database/
│   ├── schema.sql         # Full PostgreSQL schema (30+ tables)
│   ├── seed.sql           # Initial data (admin, roles, pipeline stages)
│   └── migrations/        # Schema migrations
├── infra/
│   ├── cloudformation.yaml     # Main stack (VPC, RDS, Lambda, S3, etc.)
│   ├── cloudformation-ai.yaml  # AI stack (Bedrock roles, KB bucket)
│   ├── deploy.sh               # One-command full deployment
│   └── lambda-handler.js       # NestJS Lambda wrapper
└── docs/
```

---

## 🚀 CRM Features

| Module | Features |
|--------|----------|
| **Dashboard** | KPI cards, Pipeline by Stage, Deal by Source, Kanban, Agents comparison, Tasks overview |
| **Pipeline** | Kanban drag-drop, stage value totals, Sales Rep filter |
| **Lead Management** | Search, filter by status, edit, delete, sort |
| **Accounts** | Company info, contacts, shareholders, documents, Thai address |
| **Quotations** | Create → Submit for Approval → Approve/Reject → Accepted |
| **Tasks** | CRUD, priority, status, assigned to, overdue tracking |
| **Products** | Catalog with SKU, price, WHT rate |
| **Settings** | Users (CRUD + delete), Roles & Permissions, AI Configuration, Knowledge Base |
| **Calendar** | Task-based calendar view |
| **Notifications** | In-app, LINE, Email |

---

## 🔐 Security

- Multi-tenant with PostgreSQL Row-Level Security (RLS)
- JWT authentication + bcrypt password hashing
- MFA (TOTP) support
- Role-based access control (Admin, Sales Manager, Sales Rep, Viewer)
- API Key management with IP allowlist
- VPC with private subnets (no NAT Gateway — uses VPC Endpoints)
- CloudFront with security headers (HSTS, CSP, X-Frame-Options)
- RDS encryption at rest + SSL in transit

---

## 💰 Cost Estimate (Production)

| Service | Monthly Cost |
|---------|-------------|
| RDS (db.t4g.medium) | ~$30 |
| Lambda (all functions) | ~$5 |
| CloudFront Pro | $15 |
| Bedrock (100 conv/day) | ~$15 |
| S3 + SQS + SNS | ~$2 |
| VPC Endpoints | ~$15 |
| **Total** | **~$82/month** |

---

## 🛠️ Deployment

```bash
# Full deployment (first time)
cd infra
bash deploy.sh \
  --email admin@company.com \
  --name "Admin Name" \
  --password "SecurePass@123" \
  --db-pass auto \
  --tenant "Company Name"

# Frontend only
aws s3 sync frontend/ s3://sf7-prod-frontend-{account-id} --delete
aws cloudfront create-invalidation --distribution-id {id} --paths "/*"

# API Lambda only
cd services/api
npm run build
zip -j /tmp/api.zip dist/lambda.js
aws lambda update-function-code --function-name sf7-prod-crm --zip-file fileb:///tmp/api.zip
```

---

## 📋 Environment Variables (Lambda)

| Variable | Description |
|----------|-------------|
| `DB_HOST` | RDS endpoint |
| `DB_USER` | Database user |
| `DB_PASS` | Database password |
| `DB_NAME` | Database name |
| `JWT_SECRET` | JWT signing secret |
| `BEDROCK_MODEL_ID` | `global.anthropic.claude-sonnet-4-6` |
| `BEDROCK_REGION` | `ap-southeast-1` |
| `AWS_BEARER_TOKEN_BEDROCK` | Bedrock API Key (cross-account) |
| `CORS_ORIGIN` | CloudFront URL |

---

## 📄 License

Private — All rights reserved.
