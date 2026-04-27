# SalesFAST 7 — AWS Deployment ($50-80/mo budget)

## Region: ap-southeast-7 (Thailand)

## Cost Breakdown

| Service | Spec | Est. Cost |
|---------|------|-----------|
| RDS PostgreSQL | db.t4g.medium, 100GB, single-AZ | $56 |
| Lambda (5 functions) | 256MB, ~100K invocations | $1 |
| API Gateway HTTP API | ~100K requests | $1 |
| S3 (frontend + files) | ~5GB | $1 |
| SQS | ~50K messages | $0.50 |
| Secrets Manager | 2 secrets | $1 |
| VPC Endpoints (S3+SQS+SM) | 3 endpoints | $22 |
| CloudWatch Logs | basic | $2 |
| **Total** | | **~$85/mo** |

No NAT Gateway ($32/mo saved) — uses VPC endpoints instead.

## Deploy via CloudShell

```bash
# 1. Clone repo in CloudShell
git clone https://github.com/konsudtai/CRM.git
cd CRM/infra

# 2. Set passwords
export DB_PASSWORD="YourDbPassword123!"
export JWT_SECRET="YourJwtSecretAtLeast16Chars"

# 3. Deploy
bash deploy.sh
```

## Stack Components

- **VPC**: 2 public + 2 private subnets, VPC endpoints (no NAT)
- **RDS**: PostgreSQL 16, db.t4g.medium (2 vCPU, 4GB RAM), 100GB gp3, encrypted, 7-day backup
- **Lambda**: 5 functions (auth, crm, sales, quotation, notification)
- **API Gateway**: HTTP API with CORS
- **S3**: Frontend static site + file storage
- **SQS**: Event queue + DLQ
- **Secrets Manager**: DB credentials + JWT secret
