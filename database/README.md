# SalesFAST 7 — Database & Auth Setup

## PostgreSQL Schema

Single database, multi-tenant with Row-Level Security (RLS).

```bash
# Create database
createdb salesfast7

# Run schema
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

### Multi-Tenant Isolation

Every request sets `app.current_tenant` via NestJS middleware:
```sql
SET app.current_tenant = '<tenant-uuid>';
```
RLS policies on all tables ensure queries only return rows for the current tenant.

---

## AWS Cognito User Pool

Users are authenticated via Cognito. No passwords stored in PostgreSQL.

### Environment Variables

```env
COGNITO_REGION=ap-southeast-1
COGNITO_USER_POOL_ID=ap-southeast-1_XXXXXXXXX
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Auth Flow

```
1. Admin creates user via Admin Portal
   → POST /users (backend)
   → CognitoService.createUser() (creates in Cognito with temp password)
   → Save user record in PostgreSQL (with cognito_sub)

2. User logs in
   → Frontend sends email + password to Cognito
   → Cognito returns JWT tokens (IdToken, AccessToken, RefreshToken)
   → If first login: NEW_PASSWORD_REQUIRED challenge → user sets new password
   → Frontend stores tokens, sends AccessToken in Authorization header

3. API requests
   → Authorization: Bearer <cognito-access-token>
   → CognitoAuthGuard decodes JWT, looks up user by cognito_sub
   → TenantGuard sets RLS context
   → PermissionGuard checks RBAC
```

### Cognito User Pool Settings

| Setting | Value |
|---------|-------|
| Sign-in | Email only |
| Self-registration | Disabled (admin creates users) |
| MFA | Optional (TOTP) |
| Password policy | Min 8 chars, uppercase, lowercase, number |
| Token validity | Access: 1h, Refresh: 30d |
| Advanced security | Enabled |

### User Attributes

| Attribute | Cognito | PostgreSQL |
|-----------|---------|------------|
| sub | Auto-generated | users.cognito_sub |
| email | Required | users.email |
| given_name | Optional | users.first_name |
| family_name | Optional | users.last_name |
| phone_number | Optional | users.phone |

### Admin Operations (via CognitoService)

- `createUser()` — Create user with temporary password
- `setPassword()` — Set permanent password
- `disableUser()` — Deactivate user
- `enableUser()` — Reactivate user
- `resetPassword()` — Admin reset password
- `deleteUser()` — Permanently delete user
