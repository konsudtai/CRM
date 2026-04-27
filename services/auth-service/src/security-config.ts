/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Security Configuration Guide — Thai SMB CRM Platform
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This file documents the security hardening requirements for the platform.
 * Requirements: 15.1 (AES-256 at rest), 15.2 (TLS 1.2+), 15.3 (IP allowlisting)
 *
 * ─── 1. Encryption at Rest (AES-256) ────────────────────────────────────
 *
 * RDS (PostgreSQL):
 *   - Enable `StorageEncrypted: true` on the RDS instance
 *   - Use AWS KMS with a customer-managed key (CMK) or the default `aws/rds` key
 *   - CloudFormation / Terraform example:
 *       StorageEncrypted: true
 *       KmsKeyId: !Ref RdsEncryptionKey   # optional CMK
 *   - Encryption covers: data files, automated backups, read replicas, snapshots
 *
 * S3 (File Storage):
 *   - Enable default bucket encryption with SSE-S3 (AES-256) or SSE-KMS:
 *       ServerSideEncryptionConfiguration:
 *         Rules:
 *           - ServerSideEncryptionByDefault:
 *               SSEAlgorithm: "aws:kms"   # or "AES256" for SSE-S3
 *   - Enforce encryption via bucket policy denying unencrypted PutObject
 *   - All tenant files stored under `s3://{bucket}/{tenant_id}/` prefix
 *
 * ElastiCache (Redis):
 *   - Enable `AtRestEncryptionEnabled: true`
 *   - Enable `TransitEncryptionEnabled: true`
 *
 * OpenSearch:
 *   - Enable `EncryptionAtRestOptions.Enabled: true`
 *   - Use KMS key for encryption
 *
 * ─── 2. Encryption in Transit (TLS 1.2+) ────────────────────────────────
 *
 * ALB / API Gateway:
 *   - Configure HTTPS listeners with TLS 1.2 minimum policy
 *   - AWS ALB: use `ELBSecurityPolicy-TLS13-1-2-2021-06` or newer
 *   - Redirect all HTTP (port 80) to HTTPS (port 443)
 *
 * CloudFront:
 *   - Set `MinimumProtocolVersion: TLSv1.2_2021`
 *   - Enable HTTPS-only viewer protocol policy
 *
 * RDS:
 *   - Set `rds.force_ssl = 1` parameter to enforce TLS connections
 *   - Application connection string: `?ssl=true&sslmode=require`
 *
 * ElastiCache (Redis):
 *   - Enable `TransitEncryptionEnabled: true`
 *   - Connect via TLS endpoint
 *
 * OpenSearch:
 *   - Enable `NodeToNodeEncryptionOptions.Enabled: true`
 *   - Enforce HTTPS on the domain endpoint
 *
 * Service-to-Service:
 *   - All internal HTTP calls between NestJS services use HTTPS
 *   - Helmet middleware enforces HSTS headers on all responses
 *
 * ─── 3. IP Allowlisting (Per-Tenant) ────────────────────────────────────
 *
 * Implemented via `IpAllowlistGuard` in the auth service:
 *   - Tenant admins can enable/disable IP allowlisting in security settings
 *   - When enabled, only requests from IPs in the allowlist are permitted
 *   - Supports individual IPv4 addresses and CIDR notation
 *   - Cached in Redis (5-minute TTL) for performance
 *   - Managed via `GET/POST/DELETE /settings/security/ip-allowlist` endpoints
 *
 * ─── 4. Additional Security Headers ─────────────────────────────────────
 *
 * Helmet middleware is applied globally and sets:
 *   - Strict-Transport-Security (HSTS): max-age=31536000; includeSubDomains; preload
 *   - X-Content-Type-Options: nosniff
 *   - X-Frame-Options: SAMEORIGIN
 *   - X-XSS-Protection: 0 (modern browsers use CSP instead)
 *   - Content-Security-Policy (production only)
 *
 * ─── 5. Environment Variables ────────────────────────────────────────────
 *
 * Security-related environment variables:
 *   - JWT_SECRET: Secret key for JWT signing (REQUIRED in production)
 *   - DB_SSL: Set to "true" to enable SSL for PostgreSQL connections
 *   - REDIS_TLS: Set to "true" to enable TLS for Redis connections
 *   - CORS_ORIGIN: Allowed CORS origins (restrict in production)
 *   - NODE_ENV: Set to "production" to enable strict CSP headers
 */

/** Minimum TLS version enforced across all services */
export const MIN_TLS_VERSION = 'TLSv1.2';

/** HSTS max-age in seconds (1 year) */
export const HSTS_MAX_AGE = 31536000;

/** S3 encryption algorithm */
export const S3_ENCRYPTION_ALGORITHM = 'aws:kms' as const;

/** RDS encryption enabled flag — set in infrastructure config */
export const RDS_STORAGE_ENCRYPTED = true;

/** IP allowlist cache TTL in seconds */
export const IP_ALLOWLIST_CACHE_TTL = 300;
