import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../guards/tenant.guard';
import { PermissionGuard } from '../../guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { TimelineService } from './timeline.service';

@Controller('accounts')
@UseGuards(TenantGuard, PermissionGuard)
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get(':id/timeline')
  @RequirePermission('accounts', 'read')
  async getTimeline(
    @Req() req: Request,
    @Param('id') accountId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const user = (req as any).user;
    return this.timelineService.getTimeline(
      user.tenantId,
      accountId,
      page,
      limit,
    );
  }
}
