import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../guards/tenant.guard';
import { PermissionGuard } from '../../guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(TenantGuard, PermissionGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @RequirePermission('reports', 'read')
  async getDashboard(@Req() req: Request, @Query('period') period?: string) {
    const tenantId = (req as any).user.tenantId;
    return this.reportsService.getDashboardKPIs(tenantId, period || 'month');
  }

  @Get('pipeline-summary')
  @RequirePermission('reports', 'read')
  async getPipelineSummary(@Req() req: Request) {
    const tenantId = (req as any).user.tenantId;
    return this.reportsService.getPipelineSummary(tenantId);
  }

  @Get('lead-conversion')
  @RequirePermission('reports', 'read')
  async getLeadConversion(@Req() req: Request) {
    const tenantId = (req as any).user.tenantId;
    return this.reportsService.getLeadConversionFunnel(tenantId);
  }

  @Get('rep-performance')
  @RequirePermission('reports', 'read')
  async getRepPerformance(@Req() req: Request, @Query('period') period?: string) {
    const tenantId = (req as any).user.tenantId;
    return this.reportsService.getRepPerformance(tenantId, period || 'month');
  }

  @Get('top-customers')
  @RequirePermission('reports', 'read')
  async getTopCustomers(@Req() req: Request, @Query('limit') limit?: string) {
    const tenantId = (req as any).user.tenantId;
    return this.reportsService.getTopCustomers(tenantId, parseInt(limit || '10', 10));
  }

  @Get('aging-deals')
  @RequirePermission('reports', 'read')
  async getAgingDeals(@Req() req: Request) {
    const tenantId = (req as any).user.tenantId;
    return this.reportsService.getAgingDeals(tenantId);
  }

  @Get('forecast')
  @RequirePermission('reports', 'read')
  async getForecast(@Req() req: Request) {
    const tenantId = (req as any).user.tenantId;
    return this.reportsService.getSalesForecast(tenantId);
  }
}
