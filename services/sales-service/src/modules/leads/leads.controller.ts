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
import { LeadsService } from './leads.service';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { ImportLeadsDto } from './dto/import-leads.dto';
import { BulkLeadsDto } from './dto/bulk-leads.dto';

@Controller('leads')
@UseGuards(TenantGuard, PermissionGuard)
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly duplicateDetectionService: DuplicateDetectionService,
  ) {}

  @Post()
  @RequirePermission('leads', 'create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: Request, @Body() dto: CreateLeadDto) {
    const user = (req as any).user;
    return this.leadsService.create(user.tenantId, dto);
  }

  @Post('import')
  @RequirePermission('leads', 'create')
  @HttpCode(HttpStatus.OK)
  async importLeads(@Req() req: Request, @Body() dto: ImportLeadsDto) {
    const user = (req as any).user;
    return this.leadsService.importLeads(user.tenantId, dto.rows);
  }

  @Get()
  @RequirePermission('leads', 'read')
  async findAll(
    @Req() req: Request,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const user = (req as any).user;
    return this.leadsService.findAll(user.tenantId, page, limit, status, search);
  }

  @Get(':id/duplicates')
  @RequirePermission('leads', 'read')
  async findDuplicates(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user;
    return this.duplicateDetectionService.findDuplicates(user.tenantId, id);
  }

  @Get(':id')
  @RequirePermission('leads', 'read')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user;
    return this.leadsService.findOne(user.tenantId, id);
  }

  @Put(':id')
  @RequirePermission('leads', 'update')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    const user = (req as any).user;
    return this.leadsService.update(user.tenantId, id, dto);
  }

  @Put(':id/status')
  @RequirePermission('leads', 'update')
  async updateStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    const user = (req as any).user;
    return this.leadsService.updateStatus(user.tenantId, id, dto, user.sub);
  }

  @Post(':id/assign')
  @RequirePermission('leads', 'update')
  @HttpCode(HttpStatus.OK)
  async assign(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: AssignLeadDto,
  ) {
    const user = (req as any).user;
    return this.leadsService.assign(user.tenantId, id, dto.userId);
  }

  @Post('bulk')
  @RequirePermission('leads', 'update')
  @HttpCode(HttpStatus.OK)
  async bulk(@Req() req: Request, @Body() dto: BulkLeadsDto) {
    const user = (req as any).user;
    return this.leadsService.bulk(
      user.tenantId,
      dto.action,
      dto.leadIds,
      dto.value,
      user.sub,
    );
  }
}
