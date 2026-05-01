# SalesFAST 7 — AWS Deployment Architecture

## Region: ap-southeast-1 (Singapore, default) — override with --region

## Cost Breakdown (~$130/mo budget)

### CRM Infrastructure (default: ap-southeast-1)

| Service | Spec | Est. Cost |
|---------|------|-----------|
| RDS PostgreSQL | db.t4g.medium, 100GB gp3, single-AZ | $56 |
| RDS Proxy | Connection pooling (2 vCPU x $0.015/hr) | $15 |
| VPC Endpoints | 3 (S3, SQS, Secrets Manager) | $22 |
| **CloudFront Pro Plan** | **Flat-rate: CDN + WAF + DDoS + DNS + TLS + Logs + 50GB S3** | **$15** |
| AWS Backup | Daily snapshots, 7-day retention (RDS + S3) | $2 |
| CloudWatch Logs | basic + VPC Flow Logs | $2 |
| Lambda (5 functions) | 1024MB, ~100K invocations | $2 |
| API Gateway HTTP API | ~100K requests, throttled | $1 |
| S3 (frontend + files) | ~5GB (covered by Pro plan 50GB credits) | $0 |
| Secrets Manager | 3 secrets (DB + JWT + LINE) | $1.50 |
| SQS | ~50K messages | $0.50 |
| DynamoDB | 2 tables (chat history + AI state), on-demand | $1 |
| **CRM Subtotal** | | **~$118/mo** |

### AI / Bedrock (ap-southeast-1 Singapore)

| Service | Spec | Est. Cost |
|---------|------|-----------|
| S3 (Knowledge Base) | ~1GB documents | $0.25 |
| Bedrock Chat Model | Claude 3 Haiku / Nova Lite (on-demand) | $5-15 |
| Bedrock Embedding | Titan Embed v2, ~10K chunks/mo | $0.10 |
| IAM Roles | Bedrock Agent + KB (free) | $0 |
| **AI Subtotal** | | **~$5-15/mo** |

| **Total** | CRM + AI (Haiku/Nova Lite) | **~$123-133/mo** |

No NAT Gateway ($32/mo saved) — uses VPC endpoints instead.

## CloudFront Flat-Rate Pro Plan ($15/mo)

- Subscribe via AWS Console > CloudFront > Distributions > select distribution > Pricing plan > Pro
- Pro plan includes (no overage charges):
  - CloudFront CDN (750+ edge locations, HTTP/2+3)
  - AWS WAF (25 rules: SQL injection, XSS, PHP, WordPress protections)
  - Always-on DDoS protection
  - Amazon Route 53 DNS
  - Amazon CloudWatch Logs ingestion
  - TLS certificate (free)
  - Serverless edge compute (CloudFront Functions)
  - 50GB S3 storage credits/mo
  - 10M requests/mo, 50TB data transfer/mo
  - Cache tag invalidation
  - Logging included
- No separate WAF WebACL needed — WAF is managed by the plan
- OAC (Origin Access Control) secures S3 bucket — no public access
- API routes proxied through CloudFront to API Gateway
- Custom error responses for SPA routing (403/404 -> index.html)
- Blocked DDoS attacks and WAF-blocked requests do NOT count against usage allowance
- If usage exceeds allowance: reduced performance (fewer edge locations), but NO overage charges
- Ref: https://aws.amazon.com/cloudfront/pricing/

## Deploy via CloudShell

```bash
# One-command deploy (default: Singapore)
git clone https://github.com/konsudtai/CRM.git && cd CRM/infra && bash deploy.sh \
  --email admin@company.com --name "John Doe" --password "Pass@123" \
  --db-pass auto --tenant "My Company"

# Deploy to Thailand
bash deploy.sh ... --region ap-southeast-7
```

## Stack Components

- **CloudFront**: CDN with OAC for S3 + API Gateway proxy (Flat Rate PRO plan)
- **VPC**: 2 public + 2 private subnets, VPC endpoints (no NAT)
- **RDS**: PostgreSQL 16, db.t4g.medium (2 vCPU, 4GB RAM), 100GB gp3, encrypted, 7-day backup
- **Lambda**: 5 functions (auth, crm, sales, quotation, notification)
- **API Gateway**: HTTP API with CORS
- **S3**: Frontend static site (private, served via CloudFront) + file storage
- **SQS**: Event queue + DLQ
- **Secrets Manager**: DB credentials + JWT secret

## Architecture Diagram

```
User -> CloudFront (Flat Rate PRO)
           |
           +-- /auth/*, /users/*, /roles/*     -> API Gateway -> Auth Lambda
           +-- /accounts/*, /tasks/*           -> API Gateway -> CRM Lambda
           +-- /leads/*, /pipeline/*, /reports/* -> API Gateway -> Sales Lambda
           +-- /quotations/*, /products/*      -> API Gateway -> Quotation Lambda
           +-- /* (static files)               -> S3 (OAC)
           
           Notification Lambda <- SQS Event Queue
           
           All Lambdas -> RDS PostgreSQL (private subnet)
                       -> Secrets Manager (VPC endpoint)
                       -> S3 Files (VPC endpoint)
                       -> SQS (VPC endpoint)
```

## Security

- WAF: Included in CloudFront Pro plan (25 rules: SQL injection, XSS, PHP, WordPress, rate limiting)
- S3 frontend bucket: private (BlockPublicAccess), AES-256 encrypted, served only via CloudFront OAC
- CloudFront: TLS 1.2+ minimum, security headers (HSTS, CSP, X-Frame-Options), DDoS protection included
- RDS: private subnet, encrypted at rest, SSL enforced, 7-day backup, deletion protection
- Lambda: runs in VPC private subnets, restricted egress (VPC CIDR only)
- Secrets: stored in AWS Secrets Manager
- Auth: bcrypt + JWT (no Cognito), account lockout after 5 failed attempts
- API: CORS restricted to CloudFront domain, API Gateway throttling (50 req/s)
- Database: Row Level Security (RLS) on all tables, parameterized tenant queries
- VPC Flow Logs: enabled for network audit trail
- CloudWatch Alarms: auth errors, 4xx rate, RDS connections

## Default Credentials

- Admin: (configured during deploy via `--email` and `--password` flags)
- 4 default roles: Admin, Sales Manager, Sales Rep, Viewer
