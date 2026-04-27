# SalesFAST 7 — AWS Deployment Architecture

## Region: ap-southeast-7 (Thailand)

## Stack (Core)

```
                         ┌─────────────────────────────────────────────┐
                         │              CloudFront CDN                 │
                         │         (frontend static files)             │
                         └──────────────────┬──────────────────────────┘
                                            │
                    ┌───────────────────────┬┴──────────────────────────┐
                    │                       │                           │
              ┌─────▼─────┐          ┌──────▼──────┐            ┌──────▼──────┐
              │  S3 Bucket │          │ API Gateway │            │  S3 Bucket  │
              │  (frontend)│          │  (REST API) │            │   (files)   │
              └────────────┘          └──────┬──────┘            └─────────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              │              │              │
                        ┌─────▼────┐   ┌─────▼────┐  ┌─────▼────┐
                        │  Lambda  │   │  Lambda  │  │  Lambda  │
                        │  (auth)  │   │  (crm)   │  │  (sales) │
                        └──────────┘   └──────────┘  └──────────┘
                        ┌──────────┐   ┌──────────┐
                        │  Lambda  │   │  Lambda  │
                        │(quotation│   │ (notif)  │
                        └──────────┘   └──────────┘
                              │              │
                    ┌─────────┴──────────────┘
                    │
         ┌──────────┼──────────┬──────────────┐
         │          │          │              │
    ┌────▼───┐ ┌────▼───┐ ┌───▼────┐   ┌────▼───┐
    │  RDS   │ │  SQS   │ │   S3   │   │Secrets │
    │Postgres│ │Queues  │ │ Files  │   │Manager │
    └────────┘ └────────┘ └────────┘   └────────┘
```

### Optional (enable when needed)

```
    ┌────────┐  ┌────────┐  ┌────────┐
    │ Redis  │  │OpenSrch│  │Bedrock │
    │(cache) │  │(search)│  │  (AI)  │
    └────────┘  └────────┘  └────────┘
```

---

## Core Services (always on)

### 1. Frontend — CloudFront + S3

| Component | Service | Details |
|-----------|---------|---------|
| Static hosting | S3 | `sf7-frontend` bucket |
| CDN | CloudFront | HTTPS, gzip, cache 24h |
| Domain | Route 53 | `app.salesfast7.com` |
| SSL | ACM | Wildcard cert |

### 2. API — API Gateway + Lambda

5 Lambda functions, Node.js 20.x ARM64:

| Function | Routes | Memory | Timeout |
|----------|--------|--------|---------|
| `sf7-auth` | `/auth/*`, `/users/*`, `/roles/*`, `/tenants/*` | 512MB | 10s |
| `sf7-crm` | `/accounts/*`, `/contacts/*`, `/tasks/*`, `/notes/*`, `/tags/*`, `/timeline/*` | 512MB | 15s |
| `sf7-sales` | `/leads/*`, `/opportunities/*`, `/pipeline/*`, `/targets/*`, `/reports/*` | 512MB | 15s |
| `sf7-quotation` | `/quotations/*`, `/products/*` | 512MB | 30s |
| `sf7-notification` | `/notifications/*`, `/webhooks/*`, `/line/*` | 512MB | 15s |

### 3. Database — RDS PostgreSQL

| Setting | Value |
|---------|-------|
| Engine | PostgreSQL 16 |
| Instance | db.t4g.medium |
| Storage | gp3, 100GB auto-scale |
| Multi-AZ | Yes (production) |
| Proxy | RDS Proxy (Lambda connection pooling) |
| Encryption | KMS |
| RLS | Enabled on all tenant tables |

### 4. Queue — SQS

| Queue | Purpose |
|-------|---------|
| `sf7-events` | Domain events (lead.created, deal.stage_changed) |
| `sf7-notifications` | LINE/email delivery |
| `sf7-webhooks` | Webhook delivery with retry |
| `sf7-*-dlq` | Dead letter queues for each |

### 5. File Storage — S3

| Bucket | Purpose |
|--------|---------|
| `sf7-frontend` | Static frontend |
| `sf7-files` | PDFs, attachments (`{tenant_id}/{type}/{id}/{file}`) |

### 6. Secrets — Secrets Manager

| Secret | Content |
|--------|---------|
| `sf7/db` | DB host, port, username, password |
| `sf7/jwt` | JWT signing secret |
| `sf7/line` | LINE channel tokens (per tenant) |

---

## Optional Services (enable via env vars)

### Redis Cache (off by default)

เปิดใช้เมื่อ traffic สูง ต้องการ cache dashboard queries, rate limiting, session store

```env
REDIS_ENABLED=true
REDIS_HOST=xxx.cache.amazonaws.com
REDIS_PORT=6379
```

เมื่อ Redis ปิด:
- Rate limiting → ใช้ in-memory counter (per Lambda instance)
- Session → JWT stateless (ไม่ต้อง store)
- Cache → query DB ตรง

### OpenSearch (off by default)

เปิดใช้เมื่อต้องการ full-text search ภาษาไทย

```env
OPENSEARCH_ENABLED=true
OPENSEARCH_ENDPOINT=https://xxx.aoss.amazonaws.com
```

เมื่อ OpenSearch ปิด:
- Search → ใช้ PostgreSQL `ILIKE` / `tsvector` แทน

### Bedrock AI (off by default)

เปิดใช้เมื่อต้องการ AI features (lead scoring, chatbot, summarization)

```env
BEDROCK_ENABLED=true
BEDROCK_API_KEY=your-bedrock-api-key
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
```

เมื่อ Bedrock ปิด:
- AI Lead Scoring → ไม่แสดง score
- AI Chatbot → ไม่แสดง
- Meeting Summary → ไม่แสดง
- Close Probability → ไม่แสดง

---

## Environment Variables (Complete)

```env
# === CORE (required) ===
AWS_REGION=ap-southeast-7

# Database
DB_HOST=sf7-db.xxx.ap-southeast-7.rds.amazonaws.com
DB_PORT=5432
DB_USERNAME=salesfast7
DB_PASSWORD=<from-secrets-manager>
DB_NAME=salesfast7

# JWT
JWT_SECRET=<from-secrets-manager>

# S3
S3_BUCKET_FILES=sf7-files

# SQS
SQS_EVENTS_URL=https://sqs.ap-southeast-7.amazonaws.com/xxx/sf7-events
SQS_NOTIFICATIONS_URL=https://sqs.ap-southeast-7.amazonaws.com/xxx/sf7-notifications
SQS_WEBHOOKS_URL=https://sqs.ap-southeast-7.amazonaws.com/xxx/sf7-webhooks

# === OPTIONAL ===

# Redis (off by default)
REDIS_ENABLED=false
# REDIS_HOST=
# REDIS_PORT=6379

# OpenSearch (off by default)
OPENSEARCH_ENABLED=false
# OPENSEARCH_ENDPOINT=

# Bedrock AI (off by default)
BEDROCK_ENABLED=false
# BEDROCK_API_KEY=
# BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
```

---

## Network

```
VPC: 10.0.0.0/16
├── Public Subnets (2 AZs)
│   ├── 10.0.1.0/24 — NAT Gateway
│   └── 10.0.2.0/24 — NAT Gateway
├── Private Subnets - App (2 AZs)
│   ├── 10.0.10.0/24 — Lambda ENIs
│   └── 10.0.11.0/24 — Lambda ENIs
├── Private Subnets - Data (2 AZs)
│   ├── 10.0.20.0/24 — RDS Primary
│   └── 10.0.21.0/24 — RDS Standby
└── VPC Endpoints
    ├── S3 (Gateway)
    ├── SQS (Interface)
    └── Secrets Manager (Interface)
```

---

## Cost Estimate (Monthly)

### Core only (no optional services)

| Service | Spec | Cost |
|---------|------|------|
| Lambda (5 functions) | ~500K invocations | $15 |
| API Gateway | ~500K requests | $5 |
| RDS PostgreSQL | db.t4g.medium, Multi-AZ | $140 |
| RDS Proxy | 1 proxy | $22 |
| S3 | 10GB + requests | $3 |
| CloudFront | 50GB transfer | $5 |
| SQS | ~100K messages | $1 |
| Secrets Manager | 3 secrets | $2 |
| NAT Gateway | 2 AZs | $65 |
| **Core Total** | | **~$258/mo** |

### With all optional services

| Service | Cost |
|---------|------|
| Core | $258 |
| + Redis (cache.t4g.micro) | +$13 |
| + OpenSearch Serverless (2 OCU) | +$48 |
| + Bedrock (50K requests) | +$25 |
| **Full Total** | **~$344/mo** |

---

## Deployment Pipeline

```
GitHub (main) → GitHub Actions
  ├── Lint + Type check
  ├── Unit tests
  ├── esbuild Lambda bundles
  ├── Sync frontend → S3
  ├── Deploy Lambdas
  ├── Update API Gateway
  └── Invalidate CloudFront
```

---

## Scaling

| Users | Action |
|-------|--------|
| 0-100 | Core stack as-is |
| 100-500 | Enable Redis, scale RDS to r7g.large |
| 500-2000 | Enable OpenSearch, RDS read replicas |
| 2000+ | Aurora Serverless v2, Redis cluster |
