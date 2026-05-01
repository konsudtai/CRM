/**
 * Chat Service — Manages agent orchestration, conversation state, and LINE integration.
 */
import { Injectable, Logger } from '@nestjs/common';
import { AgentOrchestrator, ChatRequest, ChatResponse } from '../../agents/orchestrator';

interface ChatParams {
  message: string;
  agentType: 'admin-ai' | 'sales-assistant' | 'analytics' | 'auto';
  tenantId: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  context?: Record<string, any>;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private orchestrators = new Map<string, AgentOrchestrator>();

  /**
   * Get or create an orchestrator for a tenant+user combination.
   * Each user gets their own orchestrator with their role/permissions.
   */
  private getOrchestrator(params: ChatParams): AgentOrchestrator {
    const key = `${params.tenantId}:${params.userId || 'anon'}`;

    if (!this.orchestrators.has(key)) {
      this.orchestrators.set(key, new AgentOrchestrator({
        modelId: process.env.BEDROCK_MODEL_ID || undefined,
        region: process.env.BEDROCK_REGION || undefined,
        knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID || undefined,
        tenantId: params.tenantId,
        userId: params.userId,
        userName: params.userName,
        userRole: params.userRole,
      }));
    }

    return this.orchestrators.get(key)!;
  }

  /**
   * Send a message and get a complete response.
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    this.logger.log(`Chat: agent=${params.agentType} tenant=${params.tenantId} user=${params.userId}`);

    const orchestrator = this.getOrchestrator(params);

    try {
      const response = await orchestrator.chat({
        message: params.message,
        agentType: params.agentType,
        conversationHistory: params.conversationHistory,
        context: params.context,
      });

      this.logger.log(`Response: agent=${response.agentUsed} tools=${response.toolsUsed.join(',')}`);
      return response;
    } catch (err: any) {
      this.logger.error(`Chat error: ${err.message}`, err.stack);
      return {
        message: 'ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งค่ะ',
        agentUsed: 'error',
        toolsUsed: [],
        handoffs: [],
      };
    }
  }

  /**
   * Stream a response (SSE).
   */
  async *stream(params: ChatParams) {
    this.logger.log(`Stream: agent=${params.agentType} tenant=${params.tenantId}`);

    const orchestrator = this.getOrchestrator(params);

    try {
      yield* orchestrator.stream({
        message: params.message,
        agentType: params.agentType,
        conversationHistory: params.conversationHistory,
        context: params.context,
      });
    } catch (err: any) {
      this.logger.error(`Stream error: ${err.message}`, err.stack);
      yield { type: 'error', content: 'ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งค่ะ' };
    }
  }

  /**
   * Handle incoming LINE messages — routes to Admin AI Agent.
   */
  async handleLineMessage(body: {
    lineUserId: string;
    message: string;
    tenantId: string;
    replyToken?: string;
  }) {
    this.logger.log(`LINE message: tenant=${body.tenantId} user=${body.lineUserId}`);

    const response = await this.chat({
      message: body.message,
      agentType: 'admin-ai',
      tenantId: body.tenantId,
      userId: body.lineUserId,
      userRole: 'customer',
      context: { channel: 'line', replyToken: body.replyToken },
    });

    // Send reply back via notification service
    if (body.replyToken) {
      try {
        const NOTIFICATION_API = process.env.NOTIFICATION_API_URL || 'http://localhost:3005';
        await fetch(`${NOTIFICATION_API}/line/reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            replyToken: body.replyToken,
            message: response.message,
            tenantId: body.tenantId,
          }),
        });
      } catch (err: any) {
        this.logger.error(`LINE reply error: ${err.message}`);
      }
    }

    return response;
  }

  /**
   * Cleanup old orchestrators to prevent memory leaks.
   */
  cleanup() {
    const maxAge = 30 * 60 * 1000; // 30 minutes
    // In production, use Redis for session state instead of in-memory Map
    if (this.orchestrators.size > 100) {
      this.orchestrators.clear();
      this.logger.warn('Cleared orchestrator cache (exceeded 100 entries)');
    }
  }
}
