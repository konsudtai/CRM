# SalesFAST 7

**Agentic AI CRM for Thai SMB** | Bilingual (TH/EN) | Serverless on AWS | Amazon Bedrock AgentCore

SalesFAST 7 is a full-featured CRM platform with 3 AI Agents deployed on **Amazon Bedrock AgentCore Runtime** that work as real sales team members — scoring leads, creating quotations, sending notifications, and analyzing data. All agent actions write to the real database through MCP tools.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Full Architecture](#full-architecture)
- [Project Structure](#project-structure)
- [CRM User Journey](#crm-user-journey)
- [Function Flow](#function-flow)
- [AI Agent System](#ai-agent-system)
- [Deployment](#deployment)
- [AWS Cost](#aws-cost)
- [Database Schema](#database-schema)
- [Security](#security)

---

## Features

| Module | Description |
|--------|-------------|
| Dashboard | KPI cards, Pipeline by Stage, Deal by Source, Top Deals, Sales Rep Comparison |
| Accounts | Customer 360 — company info, Thai tax ID, contacts, deals, quotations, tasks |
| Pipeline | Kanban board with drag-and-drop, value per stage |
| Lead Management | Table + Kanban, search, filter, AI scoring, duplicate detection |
| Quotations | Create, approval workflow, PDF generation, LINE delivery |
| Tasks | Task list, call logging, overdue detection, calendar view |
| Products | Product catalog with SKU, pricing, WHT rate |
| Calendar | Monthly/weekly/daily view with task creation |
| Settings | Users, Roles, LINE OA, AI config, Knowledge Base, Webhooks, PDPA |
| AI Agents | 3 agents: น้องแอ๊ด (LINE), น้องขายไว (CRM), น้องวิ (Analytics) |
| LINE OA | Auto-reply, auto-create Lead, send quotation via LINE |
| i18n | Thai/English, Buddhist calendar, Thai address format |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend (Legacy) | HTML5, CSS3, Vanilla JS — Salesforce Lightning design |
| Frontend (Next.js) | Next.js 14 App Router, TanStack Query, Zustand, Tailwind, Apple Design |
| Backend (Unified API) | Hono (TypeScript) on AWS Lambda |
| Backend (Services) | 6 NestJS microservices (TypeScript) |
| AI Runtime | Amazon Bedrock AgentCore (Python, Strands Agents SDK) |
| AI Model | Claude Sonnet 3.5 v2 (via Bedrock, ap-southeast-1) |
| Database | PostgreSQL 16 (RDS) + RDS Proxy, Row-Level Security |
| Auth | bcrypt cost-12 + JWT (15min access / 7d refresh) |
| CDN | CloudFront Pro Plan ($15/mo flat-rate, WAF + DDoS) |
| Queue | SQS + SNS fan-out (event-driven) |
| Storage | S3 AES-256 encrypted |
| IaC | CloudFormation (3 stacks) |
| Monorepo | Turborepo + npm workspaces |

---

## Full Architecture


```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    USERS                                                 │
│   👤 Sales Rep (Web)      👤 Manager (Web)      📱 ลูกค้า (LINE OA)                     │
└──────────┬─────────────────────┬─────────────────────────┬──────────────────────────────┘
           │                     │                         │
           ▼                     ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        CloudFront Pro ($15/mo flat-rate)                                  │
│                   CDN + WAF + DDoS + TLS 1.2+ + HTTP/3                                  │
│   Static Files (/*) → S3 Frontend       API Routes → API Gateway HTTP API               │
└──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                           │
┌──────────────────────────────────────────┼──────────────────────────────────────────────┐
│                           API Gateway HTTP API                                           │
│   /auth/* /users/* /roles/*           → Auth Lambda                                     │
│   /accounts/* /leads/* /tasks/* etc.  → CRM Lambda (Unified API)                        │
│   /agents/*                           → CRM Lambda → AgentCore Runtime                  │
└──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                           │
┌──────────────────────────────────────────┼──────────────────────────────────────────────┐
│                              VPC (10.0.0.0/16)                                           │
│                                                                                          │
│  ┌─── Private Subnets ───────────────────────────────────────────────────────────────┐  │
│  │                                                                                    │  │
│  │  ┌────────────────┐   ┌──────────────────────────────────────────────────────┐    │  │
│  │  │  Auth Lambda   │   │         CRM Lambda (Unified Hono API)                 │    │  │
│  │  │  • Login/JWT   │   │  All routes: accounts, leads, tasks, quotations,      │    │  │
│  │  │  • MFA/SSO     │   │  products, opportunities, dashboard, notifications,   │    │  │
│  │  │  • RBAC        │   │  activities, agents                                   │    │  │
│  │  └────────────────┘   │                                                       │    │  │
│  │                        │  /agents/chat flow:                                   │    │  │
│  │                        │    1. Try AgentCore (12s timeout via VPC Endpoint)     │    │  │
│  │                        │    2. If timeout → Fallback Bedrock Converse + tools   │    │  │
│  │                        └──────────────────────────┬───────────────────────────┘    │  │
│  │                                                   │                                │  │
│  │  ┌────────────────────────────────────────────────┼────────────────────────────┐  │  │
│  │  │              VPC Endpoints (9)                  │                             │  │  │
│  │  │  • bedrock-agentcore  ←─────────────────────────                             │  │  │
│  │  │  • bedrock-runtime (Bedrock Models)                                          │  │  │
│  │  │  • sqs, secretsmanager, logs, ecr.api, ecr.dkr                              │  │  │
│  │  │  • s3 (Gateway), dynamodb (Gateway)                                          │  │  │
│  │  └─────────────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                   │                                │  │
│  │  ┌────────────────────────────────────────────────▼────────────────────────────┐  │  │
│  │  │           AgentCore Runtime (Python) — VPC Mode                              │  │  │
│  │  │           ARN: arn:aws:bedrock-agentcore:ap-southeast-1:...:runtime/sf7_agents│  │  │
│  │  │                                                                              │  │  │
│  │  │  ┌────────────────────────────────────────────────────────────────────────┐ │  │  │
│  │  │  │  Orchestrator (keyword-based auto-routing)                              │ │  │  │
│  │  │  └──────┬──────────────────┬──────────────────┬────────────────────────────┘ │  │  │
│  │  │         │                  │                  │                               │  │  │
│  │  │  ┌──────▼──────┐    ┌─────▼───────┐    ┌─────▼───────┐                      │  │  │
│  │  │  │  น้องแอ๊ด   │    │ น้องขายไว  │    │   น้องวิ    │                      │  │  │
│  │  │  │ (Admin AI)  │    │(Sales Asst) │    │ (Analytics) │                      │  │  │
│  │  │  │ A2A→sales   │    │ A2A→analyt  │    │ (terminal)  │                      │  │  │
│  │  │  └─────────────┘    └─────────────┘    └─────────────┘                      │  │  │
│  │  │         │                  │                  │                               │  │  │
│  │  │  ┌──────▼──────────────────▼──────────────────▼────────────────────────────┐ │  │  │
│  │  │  │  14 MCP Tools (psycopg3 → PostgreSQL)                                   │ │  │  │
│  │  │  │  + Bedrock Claude (via bedrock-runtime VPC Endpoint)                     │ │  │  │
│  │  │  │  + AgentCore Memory (session context)                                    │ │  │  │
│  │  │  └─────────────────────────────────┬───────────────────────────────────────┘ │  │  │
│  │  └────────────────────────────────────┼─────────────────────────────────────────┘  │  │
│  │                                       │                                             │  │
│  │  ┌────────────────────────────────────▼─────────────────────────────────────────┐  │  │
│  │  │  RDS PostgreSQL 16 (db.t4g.medium, 100GB gp3)                                │  │  │
│  │  │  • 30+ tables with Row-Level Security (RLS)                                   │  │  │
│  │  │  • Multi-tenant isolation via tenant_id                                       │  │  │
│  │  │  • RDS Proxy (connection pooling)                                             │  │  │
│  │  │  • Encrypted at rest + SSL enforced                                           │  │  │
│  │  └──────────────────────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           Event-Driven Architecture                                      │
│                                                                                          │
│  CRM Lambda (writes) ──pub──▶ SNS Topic ──sub──▶ SQS: events → Notification Lambda     │
│                                          ──sub──▶ SQS: agent-events → Agent Lambda      │
│                                                                                          │
│  EventBridge Rules:                                                                      │
│    • cron(30 1 * * ? *)  → Agent: Daily Digest (8:30 AM Bangkok)                        │
│    • rate(6 hours)       → Agent: Deal Health Check                                      │
│    • rate(1 hour)        → Agent: Task Reminders                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
CRM/
├── apps/
│   ├── web-crm/                 Next.js 14 App Router (Apple Design System)
│   │   └── src/app/             (auth), (crm), (dashboard), (sales), (quotation), (settings)
│   └── admin-portal/            Admin dashboard (placeholder)
│
├── services/
│   ├── api/                     Unified Hono API (single Lambda — all routes)
│   │   └── src/routes/          auth, users, accounts, leads, tasks, products,
│   │                            quotations, opportunities, dashboard, agents
│   ├── auth-service/            NestJS — Auth, Users, Roles, MFA, SSO
│   ├── crm-service/             NestJS — Accounts, Contacts, Tasks, Timeline, Search
│   ├── sales-service/           NestJS — Leads, Opportunities, Pipeline, Targets
│   ├── quotation-service/       NestJS — Products, Quotations, PDF, Approval
│   ├── notification-service/    NestJS — Notifications, Webhooks, LINE OA, Rate Limit
│   ├── agent-service/           NestJS — AI Agents (Lambda deployment option)
│   ├── agentcore-py/            Python — AgentCore Runtime (PRODUCTION ✅)
│   ├── agentcore/               TypeScript — AgentCore Runtime (Docker option)
│   └── crm-mcp-server/          MCP Server — CRM DB tools for agents
│
├── packages/
│   ├── shared-types/            TypeScript interfaces (all entities)
│   ├── ui-components/           Apple Design System components (React)
│   └── utils/                   Thai localization (date, currency, address)
│
├── database/
│   ├── schema.sql               30+ tables with RLS
│   ├── seed.sql                 Default roles, admin user
│   └── migrations/              Incremental migrations
│
├── frontend/                    Legacy vanilla HTML/JS frontend (production)
│   ├── app/                     14 CRM pages
│   ├── admin/                   Admin portal
│   ├── js/                      nav.js (chat widget), data.js, i18n.js
│   └── css/app.css              Shared styles
│
└── infra/
    ├── cloudformation.yaml      Main stack (VPC, RDS, Lambda, API GW, CloudFront, SQS/SNS)
    ├── cloudformation-proxy.yaml RDS Proxy stack
    ├── cloudformation-ai.yaml   AI stack (KB bucket, IAM roles)
    ├── deploy.sh                Full deployment (11 steps)
    ├── deploy-ai.sh             AI resources deploy
    ├── deploy-agents.sh         Agent deployment (Lambda/AgentCore)
    └── destroy.sh               Destroy all resources
```


---

## CRM User Journey

### Journey 1: New Customer via LINE OA

```
ลูกค้าส่งข้อความ LINE → LINE Webhook → Notification Lambda
    → Agent (น้องแอ๊ด) ตอบอัตโนมัติ
    → ถามสินค้า → ค้น Knowledge Base → แนะนำ
    → เก็บข้อมูล (ชื่อ, เบอร์, บริษัท, สนใจอะไร)
    → create_lead → DB
    → Event: lead.created
    → Agent (น้องขายไว) Score Lead + Notify Manager
    → Manager เปิด CRM → เห็น Lead ใหม่ + AI Score
    → Assign ให้ Sales Rep
    → Event: lead.assigned
    → Agent สร้าง Task "ติดต่อลูกค้าภายใน 24 ชม."
    → ส่ง LINE แจ้ง Sales Rep
```

### Journey 2: Sales Rep Daily Workflow

```
เช้า 8:30 → Agent ส่ง Daily Digest (LINE + in-app)
    "วันนี้มี 3 งาน, 2 Lead ใหม่, 1 QT รออนุมัติ"

Sales Rep เปิด CRM → Dashboard → เห็น KPI
    → คลิก Lead → ดูรายละเอียด + AI Score
    → ถาม น้องขายไว "เตรียม meeting ลูกค้า ABC"
    → Agent ดึงข้อมูลทั้งหมด: company, contacts, deals, activities
    → แนะนำ talking points

หลัง meeting → บอก น้องขายไว "สรุป meeting"
    → Agent สร้าง Note + อัพเดท Stage + สร้าง Follow-up Task

ต้องการออก QT → บอก น้องขายไว "ออก QT ให้ลูกค้า ABC"
    → Agent ค้นสินค้า → ยืนยันรายการ → สร้าง QT (draft)
    → แจ้ง Manager ให้ approve
    → Manager approve → Agent ส่ง QT ผ่าน LINE ให้ลูกค้า
    → สร้าง Task follow-up 3 วัน
```

### Journey 3: Manager Oversight

```
Manager เปิด Dashboard → เห็น Pipeline + KPI + Team Performance
    → ถาม น้องวิ "เปรียบเทียบผลงานทีม"
    → Agent ดึงข้อมูลจริง → วิเคราะห์ → แนะนำ action

    → ถาม "ลูกค้าเสี่ยงหาย"
    → Agent ดึง churn risk → แนะนำ re-engage

ทุก 6 ชม. → Agent ตรวจ Deal Health
    → Deal ค้าง stage เดิมนาน → แจ้ง Sales Rep + Manager
    → สร้าง Task follow-up อัตโนมัติ
```

---

## Function Flow

### API Request Flow

```
Client → CloudFront → API Gateway → Lambda (VPC)
    → JWT Validation (middleware)
    → Route Handler
    → RLS: SET app.current_tenant = tenant_id
    → PostgreSQL Query
    → Response
    → (If write) Publish event to SNS Topic
```

### Agent Invocation Flow

```
POST /agents/chat { message, agentType, tenantId }
    │
    ├── Try AgentCore (12s timeout)
    │       │
    │       ▼ (via VPC Endpoint: bedrock-agentcore)
    │   AgentCore Runtime Container
    │       │
    │       ├── Orchestrator: detect intent → route to agent
    │       ├── Agent (Strands SDK): system prompt + tools
    │       ├── Bedrock Claude: reasoning + tool_use decisions
    │       ├── MCP Tools: psycopg3 → PostgreSQL (RLS)
    │       ├── A2A: delegate to other agent if needed
    │       └── Return { reply, agentUsed, sessionId }
    │
    ├── If timeout (cold start) → Fallback
    │       │
    │       ▼ (via VPC Endpoint: bedrock-runtime)
    │   Bedrock Converse API (tool_use loop in Lambda)
    │       ├── 4 basic tools: get_leads, get_lead_detail, get_pipeline, get_kpi
    │       └── Return { reply, toolsUsed }
    │
    └── Response → Client { reply, backend: "agentcore" | "bedrock-converse-fallback" }
```

### Event Processing Flow

```
CRM Write (create/update/delete)
    → Publish to SNS Topic (DomainEvent envelope)
    → Fan-out:
        ├── SQS: events → Notification Lambda
        │       → LINE push / Email / Webhook delivery
        │
        └── SQS: agent-events → Agent Lambda
                → Parse event type
                → Invoke น้องขายไว with system prompt
                → Agent takes action (score, notify, create task)
                → Writes back to DB via API
```

---

## AI Agent System

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│              Amazon Bedrock AgentCore Runtime (Python)                │
│              Serverless • Pay-per-active-CPU • VPC Mode              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Orchestrator (auto-route by keywords)                          │ │
│  │  analytics keywords → น้องวิ                                    │ │
│  │  admin/product keywords → น้องแอ๊ด                              │ │
│  │  everything else → น้องขายไว                                    │ │
│  └──────────┬──────────────────┬──────────────────┬───────────────┘ │
│             │                  │                  │                  │
│  ┌──────────▼──────┐  ┌───────▼────────┐  ┌─────▼──────────┐      │
│  │  น้องแอ๊ด       │  │  น้องขายไว     │  │  น้องวิ        │      │
│  │  (Admin AI)     │  │  (Sales Asst)  │  │  (Analytics)   │      │
│  │  temp: 0.3      │  │  temp: 0.4     │  │  temp: 0.2     │      │
│  │                 │  │                │  │                │      │
│  │  Tools:         │  │  Tools:        │  │  Tools:        │      │
│  │  • get_products │  │  • ALL 14 MCP  │  │  • pipeline    │      │
│  │  • create_lead  │  │  • ask_analyt  │  │  • kpi         │      │
│  │  • ask_sales    │  │                │  │  • performance │      │
│  │  • ask_analytics│  │                │  │  • leads       │      │
│  │                 │  │                │  │  • accounts    │      │
│  └─────────────────┘  └────────────────┘  └────────────────┘      │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  14 MCP Tools (direct PostgreSQL via psycopg3)                  │ │
│  │                                                                 │ │
│  │  LEADS:     get_leads, get_lead_detail, create_lead, update_lead│ │
│  │  ACCOUNTS:  get_accounts, get_account_detail                    │ │
│  │  USERS:     get_users                                           │ │
│  │  TASKS:     get_tasks, create_task                              │ │
│  │  PRODUCTS:  get_products                                        │ │
│  │  QUOTES:    get_quotations                                      │ │
│  │  ANALYTICS: get_pipeline_summary, get_kpi_summary,              │ │
│  │             get_sales_rep_performance                            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Infrastructure                                                 │ │
│  │  • Bedrock Claude Sonnet 3.5 v2 (via VPC Endpoint)             │ │
│  │  • PostgreSQL RDS (via VPC, same subnets)                       │ │
│  │  • AgentCore Memory (session context, 90-day retention)         │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Agent Capabilities

| Agent | Role | Tools | A2A | Use Case |
|-------|------|-------|-----|----------|
| **น้องแอ๊ด** | Admin AI | 2 MCP + 2 A2A | → sales, → analytics | ตอบลูกค้า LINE, เก็บ Lead, แนะนำสินค้า |
| **น้องขายไว** | Sales Assistant | 14 MCP + 1 A2A | → analytics | จัดการ Lead/Task/QT, Daily Digest, Deal Health |
| **น้องวิ** | Analytics | 5 MCP | (terminal) | KPI, Pipeline, Forecast, Win Rate, Churn |

### Agent Communication (A2A)

```
ลูกค้า: "ใครดูแลผมอยู่?"
    ↓
น้องแอ๊ด: ต้องการข้อมูล CRM → call ask_sales_assistant("ใครดูแลลูกค้า?")
    ↓
น้องขายไว: call get_lead_detail(search="ชื่อลูกค้า") → ได้ Sales Rep info
    ↓
น้องแอ๊ด: "คุณมีคุณสมชายดูแลอยู่ค่ะ เบอร์ 08-xxxx-xxxx ค่ะ"
```

```
Sales Rep: "Forecast เดือนหน้าเท่าไหร่?"
    ↓
น้องขายไว: ต้องการ analytics → call ask_analytics_agent("forecast")
    ↓
น้องวิ: call get_pipeline_summary() + get_kpi_summary() → วิเคราะห์
    ↓
น้องขายไว: "📈 Forecast: Best case ฿2.5M, Expected ฿1.8M, Worst ฿1.2M"
```

### Agent Journey: Lead Lifecycle

```
┌─────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌─────┐
│  NEW    │───▶│CONTACTED │───▶│ QUALIFIED │───▶│ PROPOSAL │───▶│ WON │
└─────────┘    └──────────┘    └───────────┘    └──────────┘    └─────┘
     │              │               │                │              │
     ▼              ▼               ▼                ▼              ▼
  น้องขายไว:    น้องขายไว:     น้องขายไว:      น้องขายไว:     น้องขายไว:
  • AI Score    • Log call     • Create QT     • Send QT      • Notify team
  • Tag         • Update stage • Notify Mgr    • Follow-up    • Upgrade tier
  • Notify Mgr  • Next task    • Meeting prep  • Track        • Delivery task
  • Assign rec                                                 • Win analysis
```

---

## Deployment

### Quick Start

```bash
git clone https://github.com/konsudtai/CRM.git
cd CRM/infra

# Deploy everything (CRM + AI + Agents)
bash deploy.sh \
  --email admin@company.com \
  --name "Somchai Jaidee" \
  --password "Pass@123" \
  --db-pass auto \
  --tenant "My Company"

# Deploy AgentCore separately (if needed)
bash deploy-agents.sh --agentcore
```

### Deployment Steps (11)

```
[1/11]  Deploy CloudFormation (VPC, RDS, Lambda, API GW, CloudFront, SQS/SNS, DynamoDB)
[2/11]  Get stack outputs
[3/11]  Build pg Lambda Layer + DB Init Lambda
[4/11]  Generate seed.sql with bcrypt-hashed admin password
[5/11]  Initialize database (schema + seed)
[6/11]  Upload frontend to S3
[7/11]  Invalidate CloudFront cache
[8/11]  Deploy RDS Proxy stack
[9/11]  Deploy AI stack (KB bucket, IAM roles)
[10/11] Upload Knowledge Base documents
[11/11] Deploy Agent Service code
```

---

## AWS Cost

| Component | Monthly |
|-----------|---------|
| RDS PostgreSQL (db.t4g.medium, 100GB) | $56 |
| VPC Endpoints (9 endpoints) | $22 |
| CloudFront Pro (CDN+WAF+DDoS+DNS) | $15 |
| RDS Proxy | $15 |
| Bedrock Claude (on-demand, ~30 users) | $5-30 |
| AgentCore Runtime (pay-per-active-CPU) | $2-5 |
| Lambda (2 functions) | $2-3 |
| DynamoDB (2 tables, on-demand) | $1-2 |
| S3 + SQS + SNS + Secrets + Backup | $3-5 |
| **Total** | **~$120-150/mo** |

---

## Database Schema

**30+ tables** with Row-Level Security on all tables.

| Section | Tables |
|---------|--------|
| Auth | tenants, users, roles, role_permissions, user_roles, api_keys |
| CRM | accounts, contacts, tags, account_tags, activities, notes, attachments |
| Sales | pipeline_stages, leads, opportunities, opportunity_histories, sales_targets |
| Quotations | products, quotations, quotation_line_items, quotation_sequences |
| Tasks | tasks |
| Notifications | notifications, webhook_configs, webhook_deliveries |
| Compliance | audit_logs, consent_records |
| Integrations | email_syncs, calendar_syncs |

---

## Security

| Layer | Protection |
|-------|-----------|
| Edge | WAF (SQLi, XSS, rate limit), TLS 1.2+, HSTS, CSP, DDoS |
| API | Throttling 50 req/s, CORS restricted to CloudFront domain |
| Auth | bcrypt cost-12, JWT 15min, lockout after 5 attempts (15 min) |
| DB | RLS all tables, parameterized queries, SSL enforced, encrypted at rest |
| Network | VPC private subnets, 9 VPC endpoints (no NAT), Flow Logs |
| Storage | S3 AES-256, BlockPublicAccess, OAC-only |
| Secrets | AWS Secrets Manager (DB, JWT, LINE) |
| Monitoring | CloudWatch alarms: auth errors, 4xx rate, RDS connections |
| Backup | AWS Backup daily, 7-day retention |
| Multi-tenant | Row-Level Security — complete data isolation per tenant |

---

## Roles & Permissions

| Permission | Admin | Sales Manager | Sales Rep | Viewer |
|-----------|:-----:|:------------:|:---------:|:------:|
| Accounts | CRUD | CRU | CR | R |
| Leads | CRUD | CRUD | CRU | R |
| Opportunities | CRUD | CRUD | CRU | R |
| Quotations | CRUD | CRU (approve) | CR | R |
| Tasks | CRUD | CRUD | CRU | R |
| Users/Roles | CRUD | — | — | — |
| AI Agents | All | All | Own data | Read |

---

## LINE OA Integration

```
ลูกค้าส่ง LINE → LINE Platform → Webhook URL → Notification Lambda
    → Forward to Agent (น้องแอ๊ด)
    → AI ตอบ + เก็บ Lead อัตโนมัติ
    → Reply via LINE Push Message
```

Setup: Settings > Add-ons > LINE OA > Channel Access Token + Secret

---

## License

Proprietary. All rights reserved.
