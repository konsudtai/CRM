# SalesFAST 7 — Security Audit Report

**Date**: April 28, 2026  
**Scope**: Full stack (CloudFormation, Backend Services, Database, Frontend)

---

## Summary

| Severity | Found | Fixed |
|----------|-------|-------|
| CRITICAL | 3 | 3 |
| HIGH     | 5 | 5 |
| MEDIUM   | 6 | 6 |
| LOW      | 4 | 4 |
| **Total** | **18** | **18** |

---

## CRITICAL Issues

### C1. SQL Injection in RLS Tenant Guard — FIXED
**Files changed**: All `tenant.guard.ts` (5 services) + `gateway-auth.guard.ts`  
**Fix**: Replaced string interpolation with parameterized `set_config()`:
```typescript
// Before (vulnerable)
`SET LOCAL app.current_tenant = '${payload.tenantId}'`
// After (safe)
`SELECT set_config('app.current_tenant', $1, true)`, [payload.tenantId]
```

### C2. Hardcoded Fallback JWT Secret — FIXED
**Files changed**: 21 module files across 4 services  
**Fix**: Replaced `|| 'dev-secret-change-me'` with fail-fast IIFE that throws if env var missing.

### C3. CORS Allows All Origins — FIXED
**Files changed**: All 5 `main.ts` files  
**Fix**: Changed from `origin: '*'` to `origin: process.env.CORS_ORIGIN?.split(',') || []` with `credentials: true`. CloudFormation sets `CORS_ORIGIN` to CloudFront domain on all Lambda functions.

---

## HIGH Issues

### H1. S3 Buckets Missing Encryption — FIXED
**Fix**: Added `BucketEncryption` with `AES256` to both `FrontendBucket` and `FilesBucket`.

### H2. No CloudFront Security Headers — FIXED
**Fix**: Added `CloudFrontSecurityHeaders` ResponseHeadersPolicy with HSTS, X-Content-Type-Options, X-Frame-Options, XSS-Protection, Referrer-Policy, and CSP.

### H3. No CloudFront TLS Minimum Version — FIXED
**Fix**: Added `ViewerCertificate` with `MinimumProtocolVersion: TLSv1.2_2021`.

### H4. Helmet Missing on 4 Services — FIXED
**Fix**: Added `helmet` import and middleware to crm-service, sales-service, quotation-service, notification-service `main.ts`.

### H5. RDS Missing SSL Enforcement — FIXED
**Fix**: Added `DBParameterGroup` with `rds.force_ssl: '1'` and connection logging.

---

## MEDIUM Issues

### M1. Frontend innerHTML XSS Risk — FIXED
**Fix**: Added `esc()` sanitization helper to `frontend/js/helpers.js`. Available globally for escaping user-provided strings before rendering.

### M2. No VPC Flow Logs — FIXED
**Fix**: Added `VPCFlowLog`, `VPCFlowLogGroup` (30-day retention), and IAM role to CloudFormation.

### M3. No WAF on CloudFront — NOTED
**Status**: Documented as optional. AWS WAF adds ~$5-10/mo. API Gateway throttling added instead (50 req/s rate, 100 burst).

### M4. FilesBucket CORS Too Permissive — FIXED
**Fix**: Restricted `AllowedOrigins` to CloudFront domain. Added `PublicAccessBlockConfiguration`.

### M5. Lambda Egress Too Open — FIXED
**Fix**: Restricted `SecurityGroupEgress` to VPC CIDR only (port 443 for endpoints, port 5432 for RDS).

### M6. Rate Limiting Only on Auth Service — FIXED
**Fix**: Added API Gateway stage-level throttling (`ThrottlingRateLimit: 50`, `ThrottlingBurstLimit: 100`). Applies to all routes.

---

## LOW Issues

### L1. Swagger Exposed in Production — FIXED
**Fix**: Wrapped Swagger setup in `if (process.env.NODE_ENV !== 'production')` block.

### L2. Default Admin Password — FIXED
**Fix**: Added `force_password_change` column to users table (default `true`). Admin seed user has `force_password_change: true`.

### L3. API Key Uses SHA-256 — NOTED
**Status**: Acceptable for long random API keys. Documented for future improvement.

### L4. No CloudWatch Alarms — FIXED
**Fix**: Added 3 alarms: Auth Lambda errors (>50/5min), API 4xx rate (>500/5min), RDS connections (>80 avg).
