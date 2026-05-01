/**
 * Agent Orchestrator — Coordinates the 3 agents using Strands Swarm pattern.
 *
 * The orchestrator decides which agent should handle a request based on context:
 * - LINE messages → Admin AI Agent
 * - CRM actions (assign, QT, tasks) → น้องขายไว
 * - Analytics questions → น้องวิ
 *
 * Agents can also hand off to each other:
 * - Admin AI creates a Lead → notifies น้องขายไว to assign
 * - น้องขายไว needs forecast → asks น้องวิ
 */
import { Agent } from '@strands-agents/sdk';
import { BedrockModel } from '@strands-agents/sdk/models/bedrock';
import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { createAdminAIAgent } from './admin-ai.agent';
import { createSalesAssistantAgent } from './sales-assistant.agent';
import { createAnalyticsAgent } from './analytics.agent';

export interface AgentConfig {
  modelId?: string;
  region?: string;
  knowledgeBaseId?: string;
  tenantId: string;
  userId?: string;
  userName?: string;
  userRole?: string;
}

export interface ChatRequest {
  message: string;
  agentType: 'admin-ai' | 'sales-assistant' | 'analytics' | 'auto';
  conversationHistory?: Array<{ role: string; content: string }>;
  context?: Record<string, any>;
}

export interface ChatResponse {
  message: string;
  agentUsed: string;
  toolsUsed: string[];
  handoffs: string[];
}

export class AgentOrchestrator {
  private adminAgent: Agent;
  private salesAgent: Agent;
  private analyticsAgent: Agent;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;

    this.adminAgent = createAdminAIAgent({
      modelId: config.modelId,
      region: config.region,
      knowledgeBaseId: config.knowledgeBaseId,
    });

    this.salesAgent = createSalesAssistantAgent({
      modelId: config.modelId,
      region: config.region,
      userRole: config.userRole,
      userName: config.userName,
      userId: config.userId,
      tenantId: config.tenantId,
    });

    this.analyticsAgent = createAnalyticsAgent({
      modelId: config.modelId,
      region: config.region,
      tenantId: config.tenantId,
    });
  }

  /**
   * Route a message to the appropriate agent.
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const agentType = request.agentType === 'auto'
      ? this.detectAgentType(request.message)
      : request.agentType;

    const agent = this.getAgent(agentType);
    const agentName = this.getAgentName(agentType);

    // Inject tenant context into the message
    const contextPrefix = `[Context: tenantId=${this.config.tenantId}, userId=${this.config.userId}]\n`;
    const fullMessage = contextPrefix + request.message;

    const result = await agent.invoke(fullMessage);

    return {
      message: result.lastMessage || '',
      agentUsed: agentName,
      toolsUsed: this.extractToolsUsed(result),
      handoffs: [],
    };
  }

  /**
   * Stream a response from the appropriate agent.
   */
  async *stream(request: ChatRequest): AsyncGenerator<{
    type: string;
    content?: string;
    agentUsed?: string;
  }> {
    const agentType = request.agentType === 'auto'
      ? this.detectAgentType(request.message)
      : request.agentType;

    const agent = this.getAgent(agentType);
    const agentName = this.getAgentName(agentType);

    yield { type: 'agent_selected', agentUsed: agentName };

    const contextPrefix = `[Context: tenantId=${this.config.tenantId}, userId=${this.config.userId}]\n`;
    const fullMessage = contextPrefix + request.message;

    for await (const event of agent.stream(fullMessage)) {
      if (event.type === 'modelStreamUpdateEvent') {
        yield { type: 'text', content: (event as any).data || '' };
      } else if (event.type === 'toolStartEvent') {
        yield { type: 'tool_start', content: (event as any).toolName || '' };
      } else if (event.type === 'toolEndEvent') {
        yield { type: 'tool_end', content: (event as any).toolName || '' };
      }
    }

    yield { type: 'done', agentUsed: agentName };
  }

  /**
   * Auto-detect which agent should handle the message.
   */
  private detectAgentType(message: string): 'admin-ai' | 'sales-assistant' | 'analytics' {
    const lower = message.toLowerCase();

    // Analytics keywords
    const analyticsKeywords = [
      'forecast', 'พยากรณ์', 'churn', 'เสี่ยงหาย', 'win rate', 'conversion',
      'เปรียบเทียบ', 'ทีม', 'performance', 'ผลงาน', 'revenue', 'trend',
      'sales cycle', 'ระยะเวลา', 'kpi', 'สรุปยอด', 'วิเคราะห์', 'avg deal',
      'pipeline analysis', 'bottleneck',
    ];

    // Sales assistant keywords
    const salesKeywords = [
      'assign', 'มอบหมาย', 'approve', 'อนุมัติ', 'reject', 'ปฏิเสธ',
      'qt', 'ใบเสนอราคา', 'quotation', 'สร้าง qt', 'ออก qt',
      'lead', 'task', 'งาน', 'email', 'อีเมล', 'deal', 'ลูกค้า',
      'สินค้า', 'product', 'อธิบาย', 'แนะนำ', 'follow-up', 'นัด',
    ];

    if (analyticsKeywords.some(k => lower.includes(k))) return 'analytics';
    if (salesKeywords.some(k => lower.includes(k))) return 'sales-assistant';

    // Default to sales assistant for CRM context
    return 'sales-assistant';
  }

  private getAgent(type: string): Agent {
    switch (type) {
      case 'admin-ai': return this.adminAgent;
      case 'analytics': return this.analyticsAgent;
      default: return this.salesAgent;
    }
  }

  private getAgentName(type: string): string {
    switch (type) {
      case 'admin-ai': return 'Admin AI';
      case 'analytics': return 'น้องวิ Analytics';
      default: return 'น้องขายไว';
    }
  }

  private extractToolsUsed(result: any): string[] {
    try {
      const messages = result.messages || [];
      return messages
        .filter((m: any) => m.role === 'tool')
        .map((m: any) => m.name || 'unknown');
    } catch {
      return [];
    }
  }
}
