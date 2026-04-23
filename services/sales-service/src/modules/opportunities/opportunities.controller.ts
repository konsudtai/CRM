import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../guards/tenant.guard';
import { PermissionGuard } from '../../guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { OpportunitiesService } from './opportunities.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { CloseOpportunityDto } from './dto/close-opportunity.dto';

@Controller('opportunities')
@UseGuards(TenantGuard, PermissionGuard)
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Post()
  @RequirePermission('opportunities', 'create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: Request, @Body() dto: CreateOpportunityDto) {
    const user = (req as any).user;
    return this.opportunitiesService.create(user.tenantId, dto);
  }

  @Get()
  @RequirePermission('opportunities', 'read')
  async findAll(
    @Req() req: Request,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('stageId') stageId?: string,
  ) {
    const user = (req as any).user;
    return this.opportunitiesService.findAll(user.tenantId, page, limit, stageId);
  }

  @Get(':id')
  @RequirePermission('opportunities', 'read')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user;
    return this.opportunitiesService.findOne(user.tenantId, id);
  }

  @Put(':id')
  @RequirePermission('opportunities', 'update')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateOpportunityDto,
  ) {
    const user = (req as any).user;
    return this.opportunitiesService.update(user.tenantId, id, dto, user.sub);
  }

  @Put(':id/stage')
  @RequirePermission('opportunities', 'update')
  async updateStage(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateStageDto,
  ) {
    const user = (req as any).user;
    return this.opportunitiesService.updateStage(user.tenantId, id, dto, user.sub);
  }

  @Put(':id/close')
  @RequirePermission('opportunities', 'update')
  async close(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CloseOpportunityDto,
  ) {
    const user = (req as any).user;
    return this.opportunitiesService.close(user.tenantId, id, dto, user.sub);
  }
}
