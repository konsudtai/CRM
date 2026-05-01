# SalesFAST 7

**Agentic AI CRM for Thai SMB** | Bilingual (TH/EN) | Serverless on AWS

SalesFAST 7 is a full-featured CRM platform with 3 AI Agents (Strands Agents SDK + Amazon Bedrock) that work as real sales team members — scoring leads, creating quotations, sending notifications, and analyzing data. All agent actions write to the real database through the same APIs the UI uses.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [AWS Cost](#aws-cost)
- [Architecture](#architecture)
- [Backend Services](#backend-services)
- [AI Agents](#ai-agents)
- [Knowledge Base](#knowledge-base)
- [LINE OA Integration](#line-oa-integration)
- [Database Schema](#database-schema)
- [Roles & Permissions](#roles--permissions)
- [Security](#security)
- [i18n — Thai / English](#i18n)

---

## Features

| Module | Description |
|--------|-------------|
| Dashboard | KPI cards, pipeline chart, revenue graph, mini Kanban, activity timeline |
| Accounts | Customer 360 — company info, Thai tax ID, contacts, deals, quotations, tasks, documents |
| Pipeline | Kanban board with drag-and-drop — New → Contacted → Qualified → Proposal → Negotiation → Won/Lost |
| Quotations | Create, approval workflow, PDF generation, VAT 7% / WHT calculation |
| Tasks | Task list with filters, call logging, linked to accounts |
| Products | Product catalog with SKU, pricing, WHT rate |
| Calendar | Monthly calendar with task creation |
| Settings | User management, Roles & Permissions, LINE OA config, AI model selection |
| Admin Portal | Tenant management, audit logs, security, API keys, webhooks, PDPA |
| AI Agents | 3 agents: Admin AI (LINE), น้องขายไว (42 tools), น้องวิ Analytics (7 tools) |
| LINE OA | Auto-reply, auto-create Lead, send product/quotation via LINE |
| i18n | Thai / English, Buddhist calendar, Thai address format |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JS — Salesforce Lightning design |
| Backend | 6 NestJS microservices (TypeScript) on AWS Lambda |
| AI Agents | Strands Agents SDK (TypeScript) + Amazon Bedrock |
| Database | PostgreSQL 16 on RDS + RDS Proxy, Row Level Security |
| Auth | bcrypt cost-12 + JWT (15min access / 7d refresh) |
| CDN | CloudFront Pro Plan ($15/mo flat-rate, includes WAF + DDoS) |
| Queue | SQS + SNS fan-out (event-driven agents) |
| Storage | S3 AES-256 encrypted |
| IaC | CloudFormation |
| Monorepo | Turborepo + npm workspaces |

---

## Project Structure

```
CRM/
├── frontend/                    Static HTML/CSS/JS
│   ├── app/                     13 pages (dashboard, accounts, leads, quotations, etc.)
│   ├── admin/                   Admin portal
│   ├── js/
│   │   ├── nav.js               Navigation + น้องขายไว chat widget (calls Agent API)
│   │   ├── data.js              API helper + UI constants (no mock data)
│   │   ├── helpers.js           Utilities: fmt(), esc(), auth helpers
│   │   └── i18n.js              Thai/English translations (150+ keys)
│   └── css/app.css              Shared stylesheet
│
├── services/                    6 NestJS microservices
│   ├── auth-service/            Port 3001 — Auth, Users, Roles, API Keys
│   ├── crm-service/             Port 3002 — Accounts, Contacts, Tasks, Notes, Tags
│   ├── sales-service/           Port 3003 — Leads, Opportunities, Pipeline, Targets
│   ├── quotation-service/       Port 3004 — Products, Quotations, PDF
│   ├── notification-service/    Port 3005 — Notifications, Webhooks, LINE OA
│   └── agent-service/           Port 3006 — 3 AI Agents (Strands SDK)
│
├── database/
│   ├── schema.sql               30+ tables with RLS
│   └── seed.sql                 Template — placeholders replaced by deploy.sh
│
├── infra/
│   ├── cloudformation.yaml      CRM stack (VPC, RDS, Lambda, API GW, S3, CloudFront, SNS, SQS)
│   ├── cloudformation-ai.yaml   AI stack (S3 KB bucket, IAM roles)
│   ├── deploy.sh                Full deployment (9 steps + pre-check)
│   ├── destroy.sh               Destroy all resources
│   └── cloudshell-deploy.sh     Interactive CloudShell deploy
│
└── packages/
    ├── shared-types/            TypeScript interfaces
    ├── ui-components/           Shared React components (future)
    └── utils/                   Thai localization utilities
```

---

## Deployment

### 1. First Time Deploy

```bash
# AWS CloudShell หรือ terminal ที่มี AWS CLI + Node.js 20+
git clone https://github.com/konsudtai/CRM.git
cd CRM/infra

bash deploy.sh \
  --email    admin@mycompany.com \
  --name     "Somchai Jaidee" \
  --password "MyPass@123" \
  --db-pass  auto \
  --tenant   "My Company Ltd"
```

`--db-pass auto` จะถามให้กรอก password เอง (interactive, ซ่อนตัวอักษร, ยืนยัน 2 ครั้ง)
หรือระบุตรง: `--db-pass "MyDbP@ss99"`

**ใช้เวลา ~15-20 นาที** Script ทำทุกอย่างอัตโนมัติ:

```
[0/9]  Pre-check — ลบ orphaned resources จาก deploy ครั้งก่อน (ถ้ามี)
[1/9]  Deploy CloudFormation (VPC, RDS, Lambda, API GW, S3, CloudFront, SNS, SQS)
[2/9]  Get stack outputs (URLs, endpoints)
[3/9]  Build pg Lambda Layer + DB Init Lambda
[4/9]  Generate seed.sql with bcrypt-hashed admin password
[5/9]  Initialize database via Lambda (schema + seed)
[6/9]  Upload frontend to S3
[7/9]  Invalidate CloudFront cache
[8/9]  Deploy AI stack (S3 KB bucket, IAM roles)
[9/9]  Upload sample Knowledge Base documents
```

**หลัง deploy:**

```
1. Subscribe CloudFront Pro Plan ($15/mo)
   Console > CloudFront > Distribution > Pricing plan > Pro

2. เปิด CloudFront URL > Login > เปลี่ยนรหัสผ่าน

3. (Optional) Setup LINE OA
   Settings > Add-ons > LINE OA > กรอก Token/Secret

4. (Optional) Setup Knowledge Base
   Bedrock Console > Create Knowledge Base > S3 source
```

| Flag | Required | Description |
|------|:--------:|-------------|
| `--email` | ✅ | Admin login email |
| `--name` | ✅ | Admin full name |
| `--password` | ✅ | Admin login password |
| `--db-pass` | ✅ | DB password (`auto` = interactive prompt) |
| `--tenant` | ✅ | Company name |
| `--region` | | Default: `ap-southeast-1` (Singapore) |
| `--ai-region` | | Default: `ap-southeast-1` |
| `--jwt` | | Default: auto-generate |
| `--stack` | | Default: `salesfast7-prod` |

### 2. Update Code

อัปเดต code ใหม่โดยไม่ลบ database — ข้อมูลเดิมยังอยู่ครบ

```bash
cd ~/CRM
git pull origin main
cd infra

bash deploy.sh \
  --email    admin@mycompany.com \
  --name     "Somchai Jaidee" \
  --password "MyPass@123" \
  --db-pass  "SAME_PASSWORD_AS_FIRST_DEPLOY" \
  --tenant   "My Company Ltd"
```

**สำคัญ:** `--db-pass` ต้องใช้ค่าเดิมที่ตั้งตอน deploy ครั้งแรก

สิ่งที่อัปเดต: Frontend (S3), Lambda code, CloudFormation resources, CloudFront cache
สิ่งที่ไม่กระทบ: Database, ข้อมูลลูกค้า, Users, Settings

### 3. Clean & Deploy New

ลบทุกอย่างแล้ว deploy ใหม่ตั้งแต่ต้น (~30 นาที) — **database จะถูกลบ**

```bash
cd ~/CRM/infra
bash destroy.sh --yes

bash deploy.sh \
  --email    admin@mycompany.com \
  --name     "Somchai Jaidee" \
  --password "MyPass@123" \
  --db-pass  auto \
  --tenant   "My Company Ltd"
```

### 4. Destroy

ลบทุกอย่าง — database, files, Lambda, CloudFront **กู้คืนไม่ได้**

```bash
cd ~/CRM/infra
bash destroy.sh
# พิมพ์ "destroy" เพื่อยืนยัน

# หรือ skip confirmation:
bash destroy.sh --yes
```

> ถ้า subscribe CloudFront Pro Plan อยู่ ต้อง cancel ใน Console ก่อน destroy
> Console > CloudFront > Distribution > Cancel pricing plan

---

## AWS Cost

| Category | Monthly Cost |
|----------|------------:|
| RDS PostgreSQL (db.t4g.medium, 100GB) | $56 |
| VPC Endpoints (3x, replaces NAT Gateway) | $22 |
| RDS Proxy | $15 |
| CloudFront Pro (CDN + WAF + DDoS) | $15 |
| Bedrock AI (Claude 3.5 Haiku, ~30 users) | $5-15 |
| Other (Backup, CloudWatch, Lambda, API GW, S3, SQS, DynamoDB, Secrets) | $10 |
| **Total** | **~$123-133/mo** |

Sweet spot: **30-50 active sales users** at ~$130/mo

---

## Architecture

```
                    ┌──────────────────────────┐
                    │  CloudFront Pro + WAF v2  │
                    └─────────┬────────┬───────┘
                     Static   │        │  API
                    ┌─────────▼──┐  ┌──▼──────────────┐
                    │  S3 Bucket │  │  API Gateway HTTP│
                    └────────────┘  └──┬──────────────┘
                                       │
         ┌────────┬────────┬───────────┼────────┬────────┐
    ┌────▼──┐┌────▼──┐┌────▼──┐┌──────▼──┐┌────▼──┐┌────▼──┐
    │ Auth  ││ CRM   ││ Sales ││Quotation││Notif. ││Agent  │
    │ 3001  ││ 3002  ││ 3003  ││  3004   ││ 3005  ││ 3006  │
    └───┬───┘└───┬───┘└───┬───┘└────┬────┘└───┬───┘└───┬───┘
        └────────┴────┬───┴─────────┘         │        │
                      │                   ┌───▼───┐    │
              ┌───────▼────────┐          │  SQS  │◄───┘
              │   RDS Proxy    │          │+ SNS  │ (event listener)
              └───────┬────────┘          └───────┘
              ┌───────▼────────┐
              │ PostgreSQL 16  │
              │ 30+ tables RLS │
              └────────────────┘
```

---

## Backend Services

| Service | Port | Modules |
|---------|:----:|---------|
| auth-service | 3001 | Auth (login, MFA, JWT), Users, Roles, API Keys, IP Allowlist, Tenant |
| crm-service | 3002 | Accounts, Contacts, Notes, Tasks, Activities, Tags, Timeline, Search, Audit, Consent, Email Sync, Calendar Sync |
| sales-service | 3003 | Leads, Opportunities, Pipeline, Targets, Reports |
| quotation-service | 3004 | Products, Quotations (VAT/WHT), PDF, Approval workflow |
| notification-service | 3005 | Notifications, Webhooks, LINE OA |
| **agent-service** | **3006** | **3 AI Agents (Strands SDK), Event Listener (SQS), Scheduler (Cron)** |


---

## AI Agents

Built with **Strands Agents SDK (TypeScript)** + **Amazon Bedrock**. All 3 agents call real APIs and write to the real database — users can still do everything manually through the UI.

### Agent 1: Admin AI — LINE OA Auto-reply

| Item | Detail |
|---|---|
| Where | LINE OA webhook → Agent Service |
| Model | Claude 3.5 Haiku |
| Tools | search_knowledge_base, create_lead, search_products, search_accounts |

```
ลูกค้าทัก LINE → Admin AI ค้น Knowledge Base → ตอบสินค้า/ราคา
→ เก็บข้อมูล → create_lead ลง DB → event: lead.created → น้องขายไว รับต่อ
```

### Agent 2: น้องขายไว — Sales Assistant (42 Tools)

| Item | Detail |
|---|---|
| Where | Every CRM page (floating widget) + Event-driven + Scheduled |
| Model | Claude 3.5 Haiku |
| Tools | 42 tools across CRM, Scoring, Activity, Deal Health, Follow-up, Notification |

**10 Agentic Features:**

| # | Feature | What it does | Writes to DB |
|---|---|---|---|
| 1 | Smart Lead Scoring | Score 0-100 (BANT) + recommend who to assign | `leads.ai_score` |
| 2 | Auto Activity Log | Log every action to Timeline | `activities` |
| 3 | Smart Follow-up | Auto-create Tasks after assign/QT/meeting | `tasks` |
| 4 | Conversation Summary | Summarize LINE chat as handoff note | `notes` |
| 5 | Deal Health Monitor | Check stale deals every 6h, score green/yellow/red | `opportunities.metadata` |
| 6 | Meeting Prep | Pull all Account data before meeting, log after | `activities`, `notes` |
| 7 | Smart Email/LINE | Compose email/LINE message for Sales | `notifications` |
| 8 | Auto-tagging | Tag industry/interest/urgency automatically | `account_tags` |
| 9 | Daily Digest | Morning summary at 8:30 per user per role | `notifications` |
| 10 | Win/Loss Analysis | Analyze when Deal closes + coaching tips | `opportunities`, `tasks` |

**Key Workflows:**

```
Lead Created → Score → Tag → Notify Manager → Manager assigns → Notify Rep → Create Task

QT Request → Search Account → Search Products → Confirm → Create QT → Notify Manager
→ Manager approves → Notify Rep → Send LINE to customer → Create follow-up Task

Deal Won → Notify team → Analyze cycle → Upgrade Account tier → Create delivery Task
Deal Lost → Record reason → Analyze → Create re-engage Task (3 months)
```

**Event-driven (SQS):**

| Event | Action |
|---|---|
| `lead.created` | Score + Tag + Notify Manager |
| `lead.assigned` | Notify Rep + Create Task + LINE |
| `task.overdue` | Remind Rep + Notify Manager |
| `quotation.finalized` | Notify Manager to approve |
| `quotation.status_changed` | Notify Rep + recommend next step |
| `opportunity.stage_changed` | Notify + recommend action + Create Task |
| `opportunity.closed` | Win/Loss analysis + delivery/re-engage Task |

**Scheduled (Cron):**

| Job | Frequency | What |
|---|---|---|
| Daily Digest | 8:30 AM | KPI, Tasks, Leads, QTs per user |
| Deal Health | Every 6h | Stale deals + churn risk |
| Task Reminders | Every 1h | Upcoming + overdue tasks |

**Role-based:**

| Feature | Sales Rep | Sales Manager | Admin |
|---|---|---|---|
| View own Leads | ✅ | ✅ all team | ✅ all |
| Assign Lead | ❌ notify Manager | ✅ | ✅ |
| Create QT (draft) | ✅ | ✅ | ✅ |
| Approve QT | ❌ | ✅ | ✅ |
| Team performance | ❌ own only | ✅ | ✅ |

### Agent 3: น้องวิ — Analytics (7 Tools)

| Item | Detail |
|---|---|
| Where | Dashboard (floating widget) |
| Model | Claude 3.5 Haiku (temperature 0.2) |
| Tools | get_kpi_summary, get_pipeline_analysis, get_revenue_data, get_sales_rep_performance, get_churn_risk_accounts, get_sales_cycle_analysis, get_forecast |

All data comes from real DB queries — no hardcoded responses.

### Agent Service Structure

```
services/agent-service/src/
├── agents/
│   ├── admin-ai.agent.ts          4 tools
│   ├── sales-assistant.agent.ts   42 tools
│   ├── analytics.agent.ts         7 tools
│   └── orchestrator.ts            auto-routing + SSE streaming
├── tools/
│   ├── crm.tools.ts               Lead, Account, QT, Task, Email (12)
│   ├── activity.tools.ts          log, note, notification, LINE (4)
│   ├── scoring.tools.ts           lead score, tier, tags, workload (5)
│   ├── deal-health.tools.ts       health, stage, close, stale (6)
│   ├── followup.tools.ts          follow-up, overdue, meeting (7)
│   ├── analytics.tools.ts         KPI, pipeline, revenue, forecast (7)
│   └── knowledge-base.tools.ts    Bedrock KB search (1)
└── modules/
    ├── chat/                      POST /agents/chat, /agents/stream (SSE)
    ├── events/                    SQS listener (8 event handlers)
    └── scheduler/                 3 cron jobs
```

---

## Knowledge Base

Stored in S3 → Bedrock Knowledge Base. Admin AI uses it to answer customer questions.

```
S3: sf7-prod-knowledge-base/
├── products/product-catalog.json    ← auto-sync from DB daily
├── company/company-profile.md       ← upload in Settings
└── faq/faq.md                       ← upload in Settings
```

Upload via: Settings > Add-ons > AI > Knowledge Base > Upload

---

## LINE OA Integration

Optional add-on. Connects SalesFAST 7 with LINE Official Account.

**Setup (10 min, one-time):**
1. Create LINE Official Account at [LINE for Business](https://lineforbusiness.com/th/)
2. Enable Messaging API at [LINE Developers](https://developers.line.biz)
3. Copy Channel Access Token + Channel Secret
4. Paste in CRM: Settings > Add-ons > LINE OA
5. Copy Webhook URL from CRM → paste in LINE Developers
6. Turn off Auto-reply in LINE OA Manager (AI Agent replies instead)

---

## Database Schema

**30+ tables** with Row Level Security (RLS) on all tables.

| Section | Tables |
|---------|--------|
| Auth | tenants, users, roles, role_permissions, user_roles, api_keys, ip_allowlist_entries |
| Accounts | accounts (45+ columns), contacts, account_shareholders, account_documents, tags, account_tags |
| Activities | activities, notes, attachments, tasks |
| Sales | pipeline_stages, leads (with ai_score), lead_scores, opportunities, opportunity_histories, sales_targets |
| Quotations | products, quotations, quotation_line_items, quotation_sequences |
| Notifications | notifications, webhook_configs, webhook_deliveries |
| Compliance | audit_logs, consent_records |
| Integrations | email_syncs, calendar_syncs |
| AI | ai_config, kb_documents, kb_chunks (pgvector) |

---

## Roles & Permissions

| Permission | Admin | Sales Manager | Sales Rep | Viewer |
|-----------|:-----:|:------------:|:---------:|:------:|
| Accounts | CRUD | CRU | CR | R |
| Contacts | CRUD | CRU | CR | R |
| Leads | CRUD | CRUD | CRU | R |
| Opportunities | CRUD | CRUD | CRU | R |
| Quotations | CRUD | CRU | CR | R |
| Tasks | CRUD | CRUD | CRU | R |
| Reports | R | R | R | R |
| Users | CRUD | — | — | — |
| Settings | RU | — | — | — |

---

## Security

| Layer | Protection |
|-------|-----------|
| Edge | WAF v2 (SQLi, XSS, rate limit), TLS 1.2+, HSTS, CSP |
| API | Throttling 50 req/s, CORS restricted to CloudFront |
| App | Helmet, JWT 15min, bcrypt cost-12, lockout after 5 attempts |
| DB | RLS all tables, parameterized queries, SSL enforced, encrypted at rest |
| Network | VPC private subnets, VPC endpoints, Flow Logs |
| Storage | S3 AES-256, BlockPublicAccess, OAC-only |
| Secrets | AWS Secrets Manager, no hardcoded fallbacks (fail-fast) |
| Monitoring | CloudWatch alarms: auth errors, 4xx rate, RDS connections |
| Backup | AWS Backup daily, 7-day retention |

---

## i18n

- 150+ translation keys (Thai / English)
- `data-i18n` attributes on HTML elements
- Language toggle in nav bar, stored in localStorage
- Thai Buddhist calendar (พ.ศ.), Thai currency (฿), Thai address format

---

## Default Credentials

No default password — set during deployment via `--email` and `--password` flags.
System forces password change on first login.

---

## License

Proprietary. All rights reserved.
