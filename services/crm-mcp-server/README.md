# CRM MCP Server

MCP (Model Context Protocol) server that exposes CRM database as tools for AI Agents.

## Architecture

```
AI Agents (น้องแอ๊ด, น้องขายไว, น้องวิ)
    │
    ▼ MCP Protocol (stdio)
CRM MCP Server
    │
    ▼ pg (PostgreSQL client)
RDS Database (salesfast7)
```

## Tools Available

| Tool | Description |
|------|-------------|
| `get_leads` | Search leads by status, assigned_to, keyword |
| `get_lead_detail` | Lead detail + assigned Sales Rep (name, phone, email) |
| `create_lead` | Create new lead |
| `update_lead` | Update lead status, assignment, metadata |
| `get_accounts` | Search accounts/customers |
| `get_account_detail` | Account detail + contacts + owner |
| `get_users` | List all users/sales reps |
| `get_tasks` | Search tasks by status, assigned_to, overdue |
| `create_task` | Create new task |
| `get_quotations` | Search quotations by status |
| `get_pipeline_summary` | Pipeline stages + lead counts + values |
| `get_kpi_summary` | All KPIs: leads, accounts, tasks, quotations, revenue |
| `get_sales_rep_performance` | Per-rep metrics |

## Setup

```bash
npm install
npm run build
```

## Environment Variables

```
DB_HOST=sf7-prod.xxx.rds.amazonaws.com
DB_PORT=5432
DB_USER=salesfast7
DB_PASS=<password>
DB_NAME=salesfast7
DB_SSL=true
```

## Usage with Strands Agents SDK

```typescript
import { Agent } from '@strands-agents/sdk';
import { MCPClient } from '@strands-agents/sdk/mcp';

const mcpClient = new MCPClient({
  command: 'node',
  args: ['services/crm-mcp-server/dist/index.js'],
  env: { DB_HOST: '...', DB_PASS: '...' },
});

const agent = new Agent({
  model: bedrockModel,
  tools: [...mcpClient.tools()],  // All CRM tools available
});
```

## Usage with MCP Config (mcp.json)

```json
{
  "mcpServers": {
    "crm": {
      "command": "node",
      "args": ["services/crm-mcp-server/dist/index.js"],
      "env": {
        "DB_HOST": "sf7-prod.xxx.rds.amazonaws.com",
        "DB_PASS": "<from secrets manager>"
      }
    }
  }
}
```
