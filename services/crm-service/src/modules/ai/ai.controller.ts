import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../guards/tenant.guard';
import { PermissionGuard } from '../../guards/permission.guard';
import { AiService } from './ai.service';
import { SummarizeDto } from './dto/summarize.dto';
import { EmailReplyDto } from './dto/email-reply.dto';
import { ChatDto } from './dto/chat.dto';
import { NlSearchDto } from './dto/search.dto';
import { v4 as uuidv4 } from 'uuid';

@Controller('ai')
@UseGuards(TenantGuard, PermissionGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('summarize')
  async summarize(@Body() dto: SummarizeDto) {
    return this.aiService.summarize(dto.meetingNotes, dto.language);
  }

  @Post('email-reply')
  async emailReply(@Body() dto: EmailReplyDto) {
    return this.aiService.emailReply(
      dto.emailThread,
      dto.customerHistory,
      dto.language,
    );
  }

  @Get('lead-score/:leadId')
  async leadScore(@Param('leadId') leadId: string) {
    // Heuristic scoring — in production, fetch lead data from DB
    return this.aiService.getLeadScore(leadId);
  }

  @Get('close-probability/:oppId')
  async closeProbability(@Param('oppId') oppId: string) {
    // Heuristic probability — in production, fetch opportunity data from DB
    return this.aiService.getCloseProbability(oppId);
  }

  @Post('chat')
  async chat(@Req() req: Request, @Body() dto: ChatDto) {
    const user = (req as any).user;
    const sessionId = dto.sessionId || uuidv4();
    return this.aiService.chat(
      user.tenantId,
      user.sub,
      sessionId,
      dto.message,
    );
  }

  @Post('search')
  async nlSearch(@Req() req: Request, @Body() dto: NlSearchDto) {
    const user = (req as any).user;
    return this.aiService.nlSearch(user.tenantId, dto.query);
  }

  @Get('next-action/:oppId')
  async nextAction(@Param('oppId') oppId: string) {
    return this.aiService.getNextAction(oppId);
  }
}
