import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/send-notification.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  async send(@Req() req: Request, @Body() dto: SendNotificationDto) {
    const tenantId = (req as any).user?.tenantId || 'default';
    const notification = await this.notificationsService.send(
      tenantId,
      dto.userId,
      dto.channel,
      dto.type,
      dto.title,
      dto.body,
      dto.metadata,
    );
    return notification;
  }

  @Get()
  async list(@Req() req: Request, @Query('userId') userId?: string) {
    const tenantId = (req as any).user?.tenantId || 'default';
    return this.notificationsService.findByTenant(tenantId, userId);
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(@Req() req: Request, @Param('id') id: string) {
    const tenantId = (req as any).user?.tenantId || 'default';
    const notification = await this.notificationsService.markAsRead(id, tenantId);
    if (!notification) {
      return { statusCode: 404, message: 'Notification not found' };
    }
    return notification;
  }
}
