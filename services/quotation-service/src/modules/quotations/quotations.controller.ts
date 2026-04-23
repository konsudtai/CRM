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
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ApproveQuotationDto } from './dto/approve-quotation.dto';
import { SendQuotationDto } from './dto/send-quotation.dto';

@Controller('quotations')
@UseGuards(TenantGuard, PermissionGuard)
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Get()
  @RequirePermission('quotations', 'read')
  async findAll(
    @Req() req: Request,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    const user = (req as any).user;
    return this.quotationsService.findAll(user.tenantId, page, limit, status);
  }

  @Post()
  @RequirePermission('quotations', 'create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: Request, @Body() dto: CreateQuotationDto) {
    const user = (req as any).user;
    return this.quotationsService.create(user.tenantId, user.sub, dto);
  }

  @Get(':id')
  @RequirePermission('quotations', 'read')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user;
    return this.quotationsService.findOne(user.tenantId, id);
  }

  @Put(':id')
  @RequirePermission('quotations', 'update')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateQuotationDto,
  ) {
    const user = (req as any).user;
    return this.quotationsService.update(user.tenantId, id, dto);
  }

  @Post(':id/finalize')
  @RequirePermission('quotations', 'update')
  @HttpCode(HttpStatus.OK)
  async finalize(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user;
    return this.quotationsService.finalize(user.tenantId, id);
  }

  @Put(':id/status')
  @RequirePermission('quotations', 'update')
  async updateStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    const user = (req as any).user;
    return this.quotationsService.updateStatus(user.tenantId, id, dto.status);
  }

  @Post(':id/approve')
  @RequirePermission('quotations', 'update')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ApproveQuotationDto,
  ) {
    const user = (req as any).user;
    return this.quotationsService.approve(user.tenantId, id, user.sub);
  }

  @Post(':id/send')
  @RequirePermission('quotations', 'update')
  @HttpCode(HttpStatus.OK)
  async send(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SendQuotationDto,
  ) {
    const user = (req as any).user;
    return this.quotationsService.send(
      user.tenantId,
      id,
      dto.channel,
      dto.recipient,
    );
  }
}
