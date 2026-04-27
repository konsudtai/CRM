# SalesFAST 7 — Database & Auth

## Region: ap-southeast-7 (Thailand)

## PostgreSQL Schema

Single database, multi-tenant with Row-Level Security (RLS).

```bash
createdb salesfast7
psql salesfast7 < database/schema.sql
```

### Tables (30 total)

| Domain | Tables |
|--------|--------|
| Auth | tenants, users, roles, role_permissions, user_roles, api_keys, ip_allowlist_entries |
| CRM | accounts, contacts, tags, account_tags, activities, notes, attachments, tasks |
| Sales | pipeline_stages, leads, lead_scores, opportunities, opportunity_histories, sales_targets |
| Quotation | products, quotations, quotation_line_items, quotation_sequences |
| Notification | notifications, webhook_configs, webhook_deliveries |
| Compliance | audit_logs, consent_records |
| Integration | email_syncs, calendar_syncs |

### Multi-Tenant Isolation (RLS)

Every request sets `app.current_tenant` via NestJS TenantGuard:
```sql
SET app.current_tenant = '<tenant-uuid>';
```

### Auth Flow (DB-based)

```
1. Admin creates user via Admin Portal
   POST /users { email, password, firstName, lastName, ... }
   -> password hashed with bcrypt (cost 12)
   -> stored in users.password_hash

2. User logs in
   POST /auth/login { email, password }
   -> bcrypt.compare(password, password_hash)
   -> if MFA enabled: return mfaRequired + mfaToken
   -> else: return JWT (accessToken + refreshToken)

3. API requests
   Authorization: Bearer <jwt-access-token>
   -> GatewayAuthGuard verifies JWT signature
   -> TenantGuard sets RLS context (SET app.current_tenant)
   -> PermissionGuard checks RBAC permissions

4. Account lockout
   -> 5 failed attempts = 15 min lockout (Redis counter)
```

### Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=salesfast7

# JWT
JWT_SECRET=your-secret-key-change-in-production

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# AWS (ap-southeast-7)
AWS_REGION=ap-southeast-7

# S3
S3_BUCKET=salesfast7-files

# SQS
SQS_QUEUE_URL=https://sqs.ap-southeast-7.amazonaws.com/xxx/salesfast7-events

# OpenSearch
OPENSEARCH_ENDPOINT=https://search-salesfast7-xxx.ap-southeast-7.es.amazonaws.com

# Bedrock (AI)
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
```

### Security

- Passwords: bcrypt cost 12
- JWT: HS256, 1h access / 30d refresh
- MFA: TOTP (optional, per user)
- Rate limit: 1,000 req/min per tenant (Redis)
- Brute force: 5 attempts = 15 min lockout
- RLS: All tables isolated by tenant_id
- Audit: Immutable audit_logs table
