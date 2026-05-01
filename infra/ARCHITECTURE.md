# SalesFAST 7 — AWS Deployment Architecture

## Region: ap-southeast-7 (Thailand)

## Cost Breakdown (~$100/mo budget)

| Service | Spec | Est. Cost |
|---------|------|-----------|
| RDS PostgreSQL | db.t4g.medium, 100GB gp3, single-AZ | $56 |
| RDS Proxy | Connection pooling (2 vCPU × $0.015/hr) | $15 |
| VPC Endpoints | 3 (S3, SQS, Secrets Manager) | $22 |
| CloudFront | Flat Rate PRO, OAC + API proxy | $10 |
| AWS Backup | Daily snapshots, 7-day retention (RDS + S3) | $2 |
| CloudWatch Logs | basic + VPC Flow Logs | $2 |
| Lambda (5 functions) | 1024MB, ~100K invocations | $2 |
| API Gateway HTTP API | ~100K requests, throttled | $1 |
| S3 (frontend + files) | ~5GB, AES-256 encrypted | $1 |
| Secrets Manager | 2 secrets | $1 |
| SQS | ~50K messages | $0.50 |
| DynamoDB | 2 tables (chat history + AI state), on-demand | $1 |
| **Total** | | **~$114/mo** |

No NAT Gateway ($32/mo saved) — uses VPC endpoints instead.

## CloudFront Flat Rate PRO

- Subscribe via AWS Console > CloudFront > Savings Bundle
- Flat Rate PRO provides predictable pricing for data transfer
- OAC (Origin Access Control) secures S3 bucket — no public access
- API routes proxied through CloudFront to API Gateway
- HTTP/2 + HTTP/3 enabled for performance
- Custom error responses for SPA routing (403/404 -> index.html)

## Deploy via CloudShell

```bash
# One-command deploy (interactive — script will ask for all inputs)
git clone https://github.com/konsudtai/CRM.git && cd CRM/infra && bash deploy.sh
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

- WAF v2: Rate limiting (1000 req/5min per IP), SQL injection, XSS, bad bot protection
- S3 frontend bucket: private (BlockPublicAccess), AES-256 encrypted, served only via CloudFront OAC
- CloudFront: TLS 1.2+ minimum, security headers (HSTS, CSP, X-Frame-Options)
- RDS: private subnet, encrypted at rest, SSL enforced, 7-day backup, deletion protection
- Lambda: runs in VPC private subnets, restricted egress (VPC CIDR only)
- Secrets: stored in AWS Secrets Manager
- Auth: bcrypt + JWT (no Cognito), account lockout after 5 failed attempts
- API: CORS restricted to CloudFront domain, API Gateway throttling (50 req/s)
- Database: Row Level Security (RLS) on all tables, parameterized tenant queries
- VPC Flow Logs: enabled for network audit trail
- CloudWatch Alarms: auth errors, 4xx rate, RDS connections

## Default Credentials

- Admin: `admin@salesfast7.com` / `Admin@1234`
- 4 default roles: Admin, Sales Manager, Sales Rep, Viewer
