/**
 * CRM MCP Client — Connects to the CRM MCP Server and provides tools to agents.
 *
 * This wraps the MCP protocol client and exposes CRM tools that agents can use
 * instead of making HTTP calls to individual service APIs.
 *
 * Usage in agents:
 *   const crmTools = await getCrmMcpTools();
 *   const agent = new Agent({ tools: [...crmTools, ...otherTools] });
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { spawn } from 'child_process';
import path from 'path';

let mcpClient: Client | null = null;
let mcpTools: any[] | null = null;

/**
 * Initialize the MCP client connection to CRM MCP Server.
 */
async function initMcpClient(): Promise<Client> {
  if (mcpClient) return mcpClient;

  const serverPath = process.env.CRM_MCP_SERVER_PATH ||
    path.resolve(__dirname, '../../../crm-mcp-server/dist/index.js');

  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath],
    env: {
      ...process.env,
      DB_HOST: process.env.DB_HOST || '',
      DB_PORT: process.env.DB_PORT || '5432',
      DB_USER: process.env.DB_USER || 'salesfast7',
      DB_PASS: process.env.DB_PASS || '',
      DB_NAME: process.env.DB_NAME || 'salesfast7',
      DB_SSL: process.env.DB_SSL || 'true',
    } as any,
  });

  mcpClient = new Client({ name: 'agent-service', version: '1.0.0' }, { capabilities: {} });
  await mcpClient.connect(transport);

  return mcpClient;
}

/**
 * Get all CRM tools from MCP Server, wrapped as Strands SDK tools.
 * These can be directly passed to Agent({ tools: [...] }).
 */
export async function getCrmMcpTools(): Promise<any[]> {
  if (mcpTools) return mcpTools;

  try {
    const client = await initMcpClient();
    const { tools: mcpToolDefs } = await client.listTools();

    // Convert MCP tool definitions to Strands SDK tools
    mcpTools = mcpToolDefs.map((mcpTool) => {
      return tool({
        name: mcpTool.name,
        description: mcpTool.description || mcpTool.name,
        inputSchema: z.object({
          // Pass all arguments as a JSON string — MCP handles parsing
          args: z.string().describe(`JSON arguments for ${mcpTool.name}. Schema: ${JSON.stringify(mcpTool.inputSchema)}`),
        }),
        callback: async (input: { args: string }) => {
          const args = JSON.parse(input.args);
          const result = await client.callTool({ name: mcpTool.name, arguments: args });
          // Extract text content from MCP response
          const textContent = (result.content as any[])
            ?.filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('\n');
          return textContent || JSON.stringify(result);
        },
      });
    });

    return mcpTools;
  } catch (err: any) {
    console.error(`Failed to connect to CRM MCP Server: ${err.message}`);
    console.error('Falling back to HTTP-based tools');
    return []; // Return empty — agents will use fallback HTTP tools
  }
}

/**
 * Disconnect MCP client (for cleanup).
 */
export async function disconnectMcpClient() {
  if (mcpClient) {
    await mcpClient.close();
    mcpClient = null;
    mcpTools = null;
  }
}
