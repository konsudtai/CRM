/**
 * Chat Controller — HTTP endpoints for agent interactions.
 * Supports both regular and streaming responses.
 */
import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';

@Controller('agents')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * POST /agents/chat — Send a message and get a complete response.
   */
  @Post('chat')
  @HttpCode(200)
  async chat(@Body() dto: ChatRequestDto, @Req() req: Request) {
    const user = (req as any).user || {};
    return this.chatService.chat({
      message: dto.message,
      agentType: dto.agentType || 'auto',
      tenantId: user.tenantId || dto.tenantId,
      userId: user.id || dto.userId,
      userName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
      userRole: user.role || dto.userRole,
      conversationHistory: dto.conversationHistory,
      context: dto.context,
    });
  }

  /**
   * POST /agents/stream — Send a message and get a streaming response (SSE).
   */
  @Post('stream')
  async stream(@Body() dto: ChatRequestDto, @Req() req: Request, @Res() res: Response) {
    const user = (req as any).user || {};

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      const stream = this.chatService.stream({
        message: dto.message,
        agentType: dto.agentType || 'auto',
        tenantId: user.tenantId || dto.tenantId,
        userId: user.id || dto.userId,
        userName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined,
        userRole: user.role || dto.userRole,
        conversationHistory: dto.conversationHistory,
        context: dto.context,
      });

      for await (const event of stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`);
      res.end();
    }
  }

  /**
   * POST /agents/line-webhook — Handle incoming LINE messages.
   * Called by the notification service when a LINE message arrives.
   */
  @Post('line-webhook')
  @HttpCode(200)
  async lineWebhook(@Body() body: { lineUserId: string; message: string; tenantId: string; replyToken?: string }) {
    return this.chatService.handleLineMessage(body);
  }
}
