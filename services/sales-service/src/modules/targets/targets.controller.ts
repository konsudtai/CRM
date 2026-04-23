import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../guards/tenant.guard';
import { PermissionGuard } from '../../guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { TargetsService } from './targets.service';
import { CreateTargetDto } from './dto/create-target.dto';

@Controller('targets')
@UseGuards(TenantGuard, PermissionGuard)
export class TargetsController {
  constructor(private readonly targetsService: TargetsService) {}

  @Post()
  @RequirePermission('targets', 'create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: Request, @Body() dto: CreateTargetDto) {
    const user = (req as any).user;
    return this.targetsService.create(user.tenantId, dto);
  }

  @Get()
  @RequirePermission('targets', 'read')
  async findAll(@Req() req: Request) {
    const user = (req as any).user;
    return this.targetsService.findAll(user.tenantId);
  }
}
