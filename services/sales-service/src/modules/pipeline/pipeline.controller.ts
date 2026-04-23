import {
  Controller,
  Get,
  Put,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../guards/tenant.guard';
import { PermissionGuard } from '../../guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { PipelineService } from './pipeline.service';
import { UpdateStagesDto } from './dto/update-stages.dto';

@Controller('pipeline')
@UseGuards(TenantGuard, PermissionGuard)
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get('stages')
  @RequirePermission('pipeline', 'read')
  async getStages(@Req() req: Request) {
    const user = (req as any).user;
    return this.pipelineService.getStages(user.tenantId);
  }

  @Put('stages')
  @RequirePermission('pipeline', 'update')
  async updateStages(@Req() req: Request, @Body() dto: UpdateStagesDto) {
    const user = (req as any).user;
    return this.pipelineService.updateStages(user.tenantId, dto.stages);
  }

  @Get('summary')
  @RequirePermission('pipeline', 'read')
  async getSummary(@Req() req: Request) {
    const user = (req as any).user;
    return this.pipelineService.getSummary(user.tenantId);
  }
}
