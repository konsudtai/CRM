import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: Request, @Body() dto: CreateWebhookDto) {
    const tenantId = (req as any).user?.tenantId || 'default';
    return this.webhooksService.create(tenantId, dto);
  }

  @Get()
  async findAll(@Req() req: Request) {
    const tenantId = (req as any).user?.tenantId || 'default';
    return this.webhooksService.findAll(tenantId);
  }

  @Put(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    const tenantId = (req as any).user?.tenantId || 'default';
    const result = await this.webhooksService.update(id, tenantId, dto);
    if (!result) throw new NotFoundException('Webhook not found');
    return result;
  }

  @Get(':id/logs')
  async getLogs(@Param('id') id: string) {
    return this.webhooksService.getDeliveryLogs(id);
  }
}
