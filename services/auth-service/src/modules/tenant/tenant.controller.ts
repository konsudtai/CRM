import { Controller, Get, Post, Put, Body, Param, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { TenantService } from './tenant.service';
import { GatewayAuthGuard } from '../../guards/gateway-auth.guard';

@Controller('tenants')
@UseGuards(GatewayAuthGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  async findAll() {
    return this.tenantService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.tenantService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: { name: string; slug: string; settings?: Record<string, unknown> }) {
    return this.tenantService.create(dto.name, dto.slug, dto.settings);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: { name?: string; isActive?: boolean; settings?: Record<string, unknown> }) {
    return this.tenantService.update(id, dto);
  }

  @Put(':id/line-config')
  async updateLineConfig(@Param('id') id: string, @Body() dto: { channelToken: string; channelSecret: string }) {
    return this.tenantService.updateLineConfig(id, dto.channelToken, dto.channelSecret);
  }
}
