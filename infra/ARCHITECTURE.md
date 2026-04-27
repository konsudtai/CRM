# SalesFAST 7 — AWS Deployment Architecture

## Region: ap-southeast-7 (Thailand)

## Overview

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
                        └─────┬────┘   └─────┬────┘  └─────┬────┘
                              │              │              │
                        ┌─────▼────┐   ┌─────▼────┐  ┌─────▼────┐
                        │  Lambda  │   │  Lambda  │  │          │
                        │(quotation│   │ (notif)  │  │          │
                        └─────┬────┘   └─────┬────┘  │          │
                              │              │       │          │
                    ┌─────────┴──────────────┴───────┴──────────┘
                    │
         ┌──────────┼──────────┬──────────────┬──────────────┐
         │          │          │              │              │
    ┌────▼───┐ ┌────▼───┐ ┌───▼────┐   ┌────▼───┐   ┌──────▼──────┐
    │  RDS   │ │ Redis  │ │OpenSrch│   │  SQS   │   │   Bedrock   │
    │Postgres│ │Elastic │ │Srvless │   │Queues  │   │  (Claude)   │
    │        │ │Cache   │ │        │   │        │   │             │
    └────────┘ └────────┘ └────────┘   └────────┘   └─────────────┘
```

---

## Component Details

### 1. Frontend — CloudFront + S3

| Component | Service | Details |
|-----------|---------|---------|
| Static hosting | S3 | `salesfast7-frontend` bucket, static website |
| CDN | CloudFront | HTTPS, custom domain, gzip, cache 24h |
| Domain | Route 53 | `app.salesfast7.com`, `admin.salesfast7.com` |
| SSL | ACM | Wildcard cert `*.salesfast7.com` |

```
S3 bucket structure:
salesfast7-frontend/
├── index.html          (redirect to landing)
├── landing.html
├── login.html
├── app/                (CRM dashboard + pages)
│   ├── dashboard.html
│   ├── accounts.html
│   └── ...
├── admin/              (Admin portal)
│   └── index.html
├── css/
│   └── app.css
└── js/
    ├── data.js
    ├── helpers.js
    └── nav.js
```

### 2. API — API Gateway + Lambda

| Component | Service | Details |
|-----------|---------|---------|
| API Gateway | HTTP API (v2) | Regional, JWT authorizer, CORS |
| Compute | Lambda | NestJS per service, 512MB, 30s timeout |
| Runtime | Node.js 20.x | ARM64 (Graviton2) for cost |
| Bundler | esbuild | Tree-shake NestJS for smaller bundles |

**Lambda Functions (5):**

| Function | Route prefix | Memory | Timeout |
|----------|-------------|--------|---------|
| `sf7-auth` | `/auth/*`, `/users/*`, `/roles/*`, `/tenants/*`, `/api-keys/*`, `/security/*` | 512MB | 10s |
| `sf7-crm` | `/accounts/*`, `/contacts/*`, `/tasks/*`, `/activities/*`, `/notes/*`, `/tags/*`, `/search/*`, `/timeline/*`, `/calendar/*`, `/email/*`, `/consent/*`, `/ai/*` | 1024MB | 30s |
| `sf7-sales` | `/leads/*`, `/opportunities/*`, `/pipeline/*`, `/targets/*`, `/reports/*` | 512MB | 15s |
| `sf7-quotation` | `/quotations/*`, `/products/*` | 512MB | 30s |
| `sf7-notification` | `/notifications/*`, `/webhooks/*`, `/line/*` | 512MB | 15s |

**API Gateway Routes:**

```
POST   /auth/login
POST   /auth/mfa/verify
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me

GET    /users
POST   /users
PUT    /users/{id}
PUT    /users/{id}/roles
PUT    /users/{id}/deactivate
PUT    /users/{id}/reset-password

GET    /accounts
POST   /accounts
GET    /accounts/{id}
PUT    /accounts/{id}
DELETE /accounts/{id}
GET    /accounts/{id}/contacts
GET    /accounts/{id}/timeline

GET    /contacts
POST   /contacts
PUT    /contacts/{id}

GET    /leads
POST   /leads
PUT    /leads/{id}
POST   /leads/import
POST   /leads/bulk
GET    /leads/{id}/duplicates

GET    /opportunities
POST   /opportunities
PUT    /opportunities/{id}
PUT    /opportunities/{id}/stage
PUT    /opportunities/{id}/close

GET    /pipeline/stages
PUT    /pipeline/stages
GET    /pipeline/summary

GET    /tasks
POST   /tasks
PUT    /tasks/{id}

GET    /quotations
POST   /quotations
PUT    /quotations/{id}
POST   /quotations/{id}/finalize
POST   /quotations/{id}/send
PUT    /quotations/{id}/status

GET    /products
POST   /products
PUT    /products/{id}

GET    /reports/dashboard
GET    /reports/pipeline-summary
GET    /reports/lead-conversion
GET    /reports/rep-performance
GET    /reports/top-customers
GET    /reports/aging-deals
GET    /reports/forecast

POST   /notifications/send
GET    /notifications
PUT    /notifications/{id}/read

POST   /webhooks
GET    /webhooks
PUT    /webhooks/{id}
GET    /webhooks/{id}/logs

GET    /search

POST   /ai/summarize
POST   /ai/chat
GET    /ai/lead-score/{leadId}
GET    /ai/close-probability/{oppId}
```

### 3. Database — RDS PostgreSQL

| Setting | Value |
|---------|-------|
| Engine | PostgreSQL 16 |
| Instance | db.t4g.medium (start), scale to db.r7g |
| Storage | gp3, 100GB, auto-scale to 500GB |
| Multi-AZ | Yes (production) |
| Backup | 7 days automated, point-in-time recovery |
| Encryption | AES-256 (KMS) |
| RLS | Enabled on all tenant tables |
| Connection | Via VPC, Lambda in same VPC |
| Proxy | RDS Proxy (connection pooling for Lambda) |

### 4. Cache — ElastiCache Redis

| Setting | Value |
|---------|-------|
| Engine | Redis 7.x |
| Node | cache.t4g.micro (start) |
| Purpose | Session, rate limiting, permission cache, dashboard cache |
| Encryption | In-transit + at-rest |
| VPC | Same as RDS + Lambda |

### 5. Search — OpenSearch Serverless

| Setting | Value |
|---------|-------|
| Type | Serverless collection |
| Purpose | Full-text search (Thai tokenizer ICU) |
| Index pattern | `sf7_{tenant_id}_*` |
| OCU | 2 (start), auto-scale |

### 6. Queue — SQS

| Queue | Purpose | DLQ |
|-------|---------|-----|
| `sf7-events` | Domain events (lead.created, deal.stage_changed, etc.) | `sf7-events-dlq` |
| `sf7-notifications` | Notification delivery (LINE, email) | `sf7-notifications-dlq` |
| `sf7-webhooks` | Webhook delivery with retry | `sf7-webhooks-dlq` |

**Event-driven Lambda triggers:**

```
sf7-events queue → sf7-notification Lambda (event consumer)
sf7-notifications queue → sf7-notification Lambda (delivery)
sf7-webhooks queue → sf7-notification Lambda (webhook delivery)
```

### 7. AI — Bedrock

| Setting | Value |
|---------|-------|
| Model | Claude 3 Haiku (cost-effective) |
| Purpose | Lead scoring, meeting summary, email reply, chatbot, NL search |
| Invocation | On-demand from sf7-crm Lambda |

### 8. File Storage — S3

| Bucket | Purpose |
|--------|---------|
| `sf7-frontend` | Static frontend files |
| `sf7-files` | Quotation PDFs, attachments, uploads |

File path pattern: `{tenant_id}/{entity_type}/{entity_id}/{filename}`

Presigned URLs for upload/download (15 min expiry).

### 9. Monitoring — CloudWatch

| Component | Metric |
|-----------|--------|
| Lambda | Duration, errors, cold starts, concurrent executions |
| API Gateway | 4xx/5xx rates, latency p50/p95/p99 |
| RDS | CPU, connections, IOPS, replication lag |
| Redis | Memory, connections, cache hit rate |
| SQS | Queue depth, age of oldest message, DLQ count |

**Alarms:**
- Lambda error rate > 1% → SNS → email
- API Gateway 5xx > 0.5% → SNS
- RDS CPU > 80% → SNS
- SQS DLQ message count > 0 → SNS
- RDS storage > 80% → SNS

### 10. Security

| Layer | Implementation |
|-------|---------------|
| Network | VPC with private subnets for RDS/Redis/OpenSearch |
| API auth | JWT verification at API Gateway level |
| Encryption at rest | KMS for RDS, S3, SQS, Redis |
| Encryption in transit | TLS 1.3 everywhere |
| WAF | AWS WAF on API Gateway (rate limit, SQL injection, XSS) |
| Secrets | Secrets Manager for DB password, JWT secret, LINE tokens |
| IAM | Least-privilege Lambda execution roles |

---

## Network Architecture

```
VPC: 10.0.0.0/16
├── Public Subnets (2 AZs)
│   ├── 10.0.1.0/24 (AZ-a) — NAT Gateway
│   └── 10.0.2.0/24 (AZ-b) — NAT Gateway
├── Private Subnets - App (2 AZs)
│   ├── 10.0.10.0/24 (AZ-a) — Lambda ENIs
│   └── 10.0.11.0/24 (AZ-b) — Lambda ENIs
├── Private Subnets - Data (2 AZs)
│   ├── 10.0.20.0/24 (AZ-a) — RDS Primary, Redis
│   └── 10.0.21.0/24 (AZ-b) — RDS Standby
└── VPC Endpoints
    ├── S3 Gateway Endpoint
    ├── SQS Interface Endpoint
    ├── Secrets Manager Interface Endpoint
    └── Bedrock Interface Endpoint
```

---

## Cost Estimate (Monthly, Production)

| Service | Spec | Est. Cost |
|---------|------|-----------|
| Lambda (5 functions) | ~500K invocations, avg 200ms | $15 |
| API Gateway | ~500K requests | $5 |
| RDS PostgreSQL | db.t4g.medium, Multi-AZ, 100GB | $140 |
| RDS Proxy | 1 proxy | $22 |
| ElastiCache Redis | cache.t4g.micro | $13 |
| OpenSearch Serverless | 2 OCU | $48 |
| S3 | 10GB storage + requests | $3 |
| CloudFront | 50GB transfer | $5 |
| SQS | ~100K messages | $1 |
| Bedrock (Claude Haiku) | ~50K requests | $25 |
| Secrets Manager | 5 secrets | $3 |
| CloudWatch | Logs + metrics | $10 |
| WAF | 1 web ACL | $6 |
| Route 53 | 1 hosted zone | $1 |
| **Total** | | **~$297/mo** |

---

## Deployment Pipeline

```
GitHub (main branch)
    │
    ▼
GitHub Actions
    ├── Lint + Type check
    ├── Unit tests (42 test files)
    ├── Build Lambda bundles (esbuild)
    ├── Build frontend (copy static files)
    │
    ▼
AWS CodePipeline / CDK Deploy
    ├── Deploy Lambda functions
    ├── Update API Gateway routes
    ├── Sync frontend to S3
    ├── Invalidate CloudFront cache
    └── Run DB migrations (if any)
```

---

## Scaling Strategy

| Load | Action |
|------|--------|
| 0-100 users | Current setup (t4g.medium RDS, micro Redis) |
| 100-500 users | Scale RDS to db.r7g.large, Redis to small |
| 500-2000 users | RDS read replicas, Redis cluster, Lambda concurrency 100 |
| 2000+ users | Aurora Serverless v2, OpenSearch dedicated, Lambda 500 concurrency |

---

## Disaster Recovery

| Component | RPO | RTO | Method |
|-----------|-----|-----|--------|
| RDS | 5 min | 15 min | Multi-AZ failover + point-in-time recovery |
| S3 | 0 | 0 | Cross-region replication (optional) |
| Redis | N/A | 5 min | Auto-failover (Multi-AZ) |
| Lambda | 0 | 0 | Stateless, auto-deploy |
| Frontend | 0 | 5 min | S3 + CloudFront, redeploy from Git |
