# crm-fargate

Containerized CRM services for ECS Fargate deployment.
Splits the monolith Lambda into 3 microservices behind a single ALB.

## Services

| Service | Port | Routes | Tasks |
|---------|------|--------|-------|
| **crm-core** | 3001 | `/auth`, `/users`, `/roles`, `/accounts`, `/leads`, `/tasks`, `/dashboard`, `/agents`, `/notifications`, `/activities`, `/settings` | 2 (HA Multi-AZ) |
| **crm-quotation** | 3002 | `/quotations`, `/products`, `/opportunities` | 1 |
| **crm-line** | 3003 | `/line-webhook`, `/line/webhook` | 1 |

## Local Development

```bash
# Install deps
npm install

# Build all services
npm run build:all

# Run individual service
npm run dev:core         # port 3001
npm run dev:quotation    # port 3002
npm run dev:line         # port 3003
```

## Build Docker Images (ARM64)

```bash
# Build single service
npm run docker:core

# Or all 3
npm run docker:core && npm run docker:quotation && npm run docker:line
```

## Test with docker-compose

```bash
# Set required env vars first
export DB_HOST=...
export DB_NAME=...
export DB_USER=...
export DB_PASSWORD=...
export JWT_SECRET=...
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...

docker-compose up --build
```

Test endpoints:
- `curl http://localhost:3001/health` (crm-core)
- `curl http://localhost:3002/health` (crm-quotation)
- `curl http://localhost:3003/health` (crm-line)

## Deploy to ECS Fargate

Phase 2 (next) will set up:
- ECR repos × 3
- ECS Cluster + Task Definitions
- ALB with path-based routing
- CloudFormation template

## Architecture

```
                 ALB (Public)
                      ↓
    ┌─────────────────┼─────────────────┐
    ↓                 ↓                 ↓
[crm-core × 2]   [crm-quotation]   [crm-line]
0.25 vCPU / 1GB  0.25 vCPU / 0.5GB 0.25 vCPU / 0.5GB
```

## Key Differences from Lambda Version

| Aspect | Lambda | Fargate |
|--------|--------|---------|
| Async LINE webhook | Self-invoke `_lineProcess` payload | `setImmediate()` in-process |
| Cold start | 1-2s | None (always-on) |
| Max execution | 15 min | Unlimited |
| Streaming | Limited | Full bidirectional |
| Tools | In-process | In-process (Phase 3 → AgentCore Gateway) |
