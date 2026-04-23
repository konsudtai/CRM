import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { LineService } from './line.service';
import { ConfigureLineDto } from './dto/configure-line.dto';

@Controller('line')
export class LineController {
  constructor(private readonly lineService: LineService) {}

  /**
   * POST /line/configure
   * Configure LINE OA channel with tenant's channel access token and secret.
   */
  @Post('configure')
  @HttpCode(HttpStatus.OK)
  async configure(
    @Req() req: Request,
    @Body() dto: ConfigureLineDto,
  ) {
    const tenantId = (req as any).user?.tenantId || 'default';
    this.lineService.configureChannel({
      tenantId,
      channelAccessToken: dto.channelAccessToken,
      channelSecret: dto.channelSecret,
    });
    return { message: 'LINE channel configured successfully' };
  }

  /**
   * POST /line/webhook
   * LINE webhook receiver for incoming customer messages.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: Request,
    @Body() body: { events?: Array<any>; destination?: string },
  ) {
    // LINE sends a verification request with no events
    if (!body.events || body.events.length === 0) {
      return { message: 'ok' };
    }

    // Determine tenant from destination or header
    const tenantId = (req as any).user?.tenantId || 'default';

    await this.lineService.handleIncomingWebhook(tenantId, body.events);
    return { message: 'ok' };
  }
}
