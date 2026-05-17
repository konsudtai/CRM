# SalesFAST 7 — Strands Agents (Phase 3)

Two AI agents on AgentCore Runtime, built with Strands SDK (Python).

## Agents

| Agent | Role | Runtime | Memory | Container |
|-------|------|---------|--------|-----------|
| **น้องขายไว** (Sales Assistant) | CRM operations: leads, accounts, quotations, tasks | `sf7-sales-strands` | `sf7-sales-memory` | `sales_agent/` |
| **น้องวิ** (Analytics Specialist) | KPI, pipeline, forecast, win rate analysis | `sf7-analytics-strands` | `sf7-analytics-memory` | `analytics_agent/` |

> **น้องแอ๊ด** (LINE OA chatbot) is a logical state machine — **not** an AI agent. Lives in `services/crm-fargate/src/routes/line-webhook.ts`.

## Architecture

```
crm-core (Fargate)
    ↓ /agents/chat (proxy)
    │
    ├──→ น้องขายไว Runtime (sf7-sales-strands)
    │      ↓ Strands SDK
    │      ├── Memory: sf7-sales-memory (short-term + semantic)
    │      ├── Tools: AgentCore Gateway (MCP)
    │      └── A2A: ask_analytics → call น้องวิ runtime
    │
    └──→ น้องวิ Runtime (sf7-analytics-strands)
           ↓ Strands SDK
           ├── Memory: sf7-analytics-memory
           ├── Tools: AgentCore Gateway (MCP)
           └── A2A: ask_sales → call น้องขายไว runtime
```

## Build & Deploy

```bash
# Setup memory resources
python3 scripts/setup-memory.py

# Build images via CodeBuild (ARM64)
bash scripts/build.sh sales
bash scripts/build.sh analytics

# Deploy runtimes
python3 scripts/deploy-runtime.py sales
python3 scripts/deploy-runtime.py analytics
```

## Folder Structure

```
agents-strands/
├── sales_agent/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── handler.py            (HTTP server: /ping, /invocations)
│   ├── agent.py              (Strands agent definition)
│   ├── tools.py              (Gateway MCP wrapper)
│   └── memory.py             (AgentCore Memory wrapper)
├── analytics_agent/
│   ├── (same structure)
├── shared/
│   ├── gateway_client.py     (MCP HTTP client)
│   ├── memory_client.py      (Memory HTTP client)
│   └── a2a.py                (A2A: invoke other runtime)
├── scripts/
│   ├── setup-memory.py       (Create 2 memories)
│   ├── build.sh              (Trigger CodeBuild)
│   └── deploy-runtime.py     (Create/update runtime)
└── codebuild-buildspec.yml
```
