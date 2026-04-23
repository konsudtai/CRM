import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../guards/tenant.guard';
import { PermissionGuard } from '../../guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { ActivitiesService } from './activities.service';
import { LogCallDto } from './dto/log-call.dto';

@Controller('activities')
@UseGuards(TenantGuard, PermissionGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post('calls')
  @RequirePermission('activities', 'create')
  @HttpCode(HttpStatus.CREATED)
  async logCall(@Req() req: Request, @Body() dto: LogCallDto) {
    const user = (req as any).user;
    return this.activitiesService.logCall(user.tenantId, user.sub, dto);
  }

  @Get('calendar')
  @RequirePermission('activities', 'read')
  async getCalendar(
    @Req() req: Request,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('view') view: 'day' | 'week' | 'month' = 'week',
  ) {
    const user = (req as any).user;
    return this.activitiesService.getCalendarView(
      user.tenantId,
      start,
      end,
      view,
    );
  }
}
