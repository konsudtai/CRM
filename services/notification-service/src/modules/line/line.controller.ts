import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { LineService } from './line.service';
import { ConfigureLineDto } from './dto/configure-line.dto';

class SendProductDto {
  @IsString() @IsNotEmpty() recipientLineId!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsNumber() price!: number;
  @IsString() @IsNotEmpty() sku!: string;
  @IsString() @IsOptional() description?: string;
}

class SendQuotationDto {
  @IsString() @IsNotEmpty() recipientLineId!: string;
  @IsString() @IsNotEmpty() quotationNumber!: string;
  @IsNumber() grandTotal!: number;
  @IsString() @IsOptional() validUntil?: string;
  @IsString() @IsOptional() pdfUrl?: string;
}

class BroadcastDto {
  @IsString({ each: true }) recipientLineIds!: string[];
  @IsString() @IsNotEmpty() text!: string;
}

@Controller('line')
export class LineController {
  constructor(private readonly lineService: LineService) {}

  // ── POST /line/configure ──────────────────────────────────────────────────
  @Post('configure')
  @HttpCode(HttpStatus.OK)
  async configure(@Req() req: Request, @Body() dto: ConfigureLineDto) {
    const tenantId = (req as any).user?.tenantId || 'default';
    this.lineService.configureChannel({
      tenantId,
      channelAccessToken: dto.channelAccessToken,
      channelSecret: dto.channelSecret,
      autoCreateLead: true,
      notifySalesRep: true,
      logTimeline: true,
    });
    return { message: 'LINE channel configured successfully', tenantId };
  }

  // ── GET /line/status ──────────────────────────────────────────────────────
  @Get('status')
  async status(@Req() req: Request) {
    const tenantId = (req as any).user?.tenantId || 'default';
    const configured = this.lineService.isConfigured(tenantId);
    return { configured, tenantId };
  }

  // ── POST /line/webhook ────────────────────────────────────────────────────
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: Request,
    @Body() body: { events?: Array<any>; destination?: string },
  ) {
    // LINE verification ping — no events
    if (!body.events || body.events.length === 0) {
      return { message: 'ok' };
    }

    // Verify LINE signature
    const signature = req.headers['x-line-signature'] as string;
    const rawBody = JSON.stringify(body);
    const tenantId = (req as any).user?.tenantId || body.destination || 'default';

    if (signature && !this.lineService.verifySignature(tenantId, rawBody, signature)) {
      throw new UnauthorizedException('Invalid LINE signature');
    }

    await this.lineService.handleIncomingWebhook(tenantId, body.events);
    return { message: 'ok' };
  }

  // ── POST /line/send/product ───────────────────────────────────────────────
  @Post('send/product')
  @HttpCode(HttpStatus.OK)
  async sendProduct(@Req() req: Request, @Body() dto: SendProductDto) {
    const tenantId = (req as any).user?.tenantId || 'default';
    const result = await this.lineService.sendProductRecommendation(
      tenantId,
      dto.recipientLineId,
      { name: dto.name, price: dto.price, sku: dto.sku, description: dto.description },
    );
    return result;
  }

  // ── POST /line/send/quotation ─────────────────────────────────────────────
  @Post('send/quotation')
  @HttpCode(HttpStatus.OK)
  async sendQuotation(@Req() req: Request, @Body() dto: SendQuotationDto) {
    const tenantId = (req as any).user?.tenantId || 'default';
    const result = await this.lineService.sendQuotationNotification(tenantId, dto.recipientLineId, {
      number: dto.quotationNumber,
      grandTotal: dto.grandTotal,
      validUntil: dto.validUntil,
      pdfUrl: dto.pdfUrl,
    });
    return result;
  }

  // ── POST /line/broadcast ──────────────────────────────────────────────────
  @Post('broadcast')
  @HttpCode(HttpStatus.OK)
  async broadcast(@Req() req: Request, @Body() dto: BroadcastDto) {
    const tenantId = (req as any).user?.tenantId || 'default';
    const result = await this.lineService.broadcastMessage(
      tenantId,
      dto.recipientLineIds,
      dto.text,
    );
    return result;
  }

  // ── POST /line/lead ───────────────────────────────────────────────────────
  // Receives lead data from LIFF contact form
  @Post('lead')
  @HttpCode(HttpStatus.OK)
  async createLeadFromLiff(@Body() body: {
    lineUserId?: string;
    lineDisplayName?: string;
    linePictureUrl?: string;
    name: string;
    phone: string;
    email?: string;
    company?: string;
    industry?: string;
    companySize?: string;
    interest?: string;
    message?: string;
    source?: string;
    submittedAt?: string;
  }) {
    // In production: forward to sales-service to create lead
    // For now: log as notification with full lead data
    this.lineService['logger'].log(
      `LIFF Lead received: ${body.name} / ${body.phone} / ${body.company || 'N/A'}`
    );
    return {
      success: true,
      message: 'Lead received',
      lead: {
        name: body.name,
        phone: body.phone,
        email: body.email,
        company: body.company,
        source: body.source || 'LINE OA - Rich Menu',
        lineUserId: body.lineUserId,
        interest: body.interest,
      }
    };
  }
}
