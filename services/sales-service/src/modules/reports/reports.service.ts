import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity } from '../../entities/opportunity.entity';
import { Lead } from '../../entities/lead.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { SalesTarget } from '../../entities/sales-target.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Opportunity) private readonly oppRepo: Repository<Opportunity>,
    @InjectRepository(Lead) private readonly leadRepo: Repository<Lead>,
    @InjectRepository(PipelineStage) private readonly stageRepo: Repository<PipelineStage>,
    @InjectRepository(SalesTarget) private readonly targetRepo: Repository<SalesTarget>,
  ) {}

  async getDashboardKPIs(tenantId: string, period: string) {
    const dateFilter = this.getDateFilter(period);

    const closedWon = await this.oppRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.estimated_value), 0)', 'total')
      .where('o.tenant_id = :tenantId', { tenantId })
      .andWhere("o.closed_reason = 'won'")
      .andWhere('o.updated_at >= :from', { from: dateFilter })
      .getRawOne();

    const newLeads = await this.leadRepo.count({
      where: { tenantId, createdAt: dateFilter as any },
    });

    const totalLeads = await this.leadRepo.count({ where: { tenantId } });
    const wonLeads = await this.leadRepo.count({ where: { tenantId, status: 'Won' } });
    const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

    const target = await this.targetRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.target_amount), 0)', 'total')
      .where('t.tenant_id = :tenantId', { tenantId })
      .getRawOne();

    const activeDeals = await this.oppRepo.count({
      where: { tenantId },
    });

    return {
      closedWon: Number(closedWon?.total || 0),
      target: Number(target?.total || 0),
      newLeads,
      conversionRate: Math.round(conversionRate * 10) / 10,
      activeDeals,
    };
  }

  async getPipelineSummary(tenantId: string) {
    const stages = await this.stageRepo.find({
      where: { tenantId },
      order: { sortOrder: 'ASC' },
    });

    const result = [];
    for (const stage of stages) {
      const opps = await this.oppRepo
        .createQueryBuilder('o')
        .select('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(o.estimated_value), 0)', 'total')
        .where('o.tenant_id = :tenantId AND o.stage_id = :stageId', {
          tenantId,
          stageId: stage.id,
        })
        .getRawOne();

      result.push({
        name: stage.name,
        color: stage.color,
        probability: stage.probability,
        dealCount: Number(opps?.count || 0),
        totalValue: Number(opps?.total || 0),
        weightedValue: Number(opps?.total || 0) * (stage.probability / 100),
      });
    }
    return result;
  }

  async getLeadConversionFunnel(tenantId: string) {
    const statuses = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won'];
    const total = await this.leadRepo.count({ where: { tenantId } });
    const funnel = [];

    for (const status of statuses) {
      const count = await this.leadRepo.count({ where: { tenantId, status } });
      funnel.push({
        stage: status,
        count,
        percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      });
    }
    return { total, funnel };
  }

  async getRepPerformance(tenantId: string, period: string) {
    const reps = await this.oppRepo
      .createQueryBuilder('o')
      .select('o.assigned_to', 'userId')
      .addSelect('COUNT(*)', 'deals')
      .addSelect('COALESCE(SUM(o.estimated_value), 0)', 'revenue')
      .where('o.tenant_id = :tenantId', { tenantId })
      .groupBy('o.assigned_to')
      .orderBy('revenue', 'DESC')
      .getRawMany();

    return reps.map((r) => ({
      userId: r.userId,
      deals: Number(r.deals),
      revenue: Number(r.revenue),
    }));
  }

  async getTopCustomers(tenantId: string, limit: number) {
    const customers = await this.oppRepo
      .createQueryBuilder('o')
      .select('o.account_id', 'accountId')
      .addSelect('COALESCE(SUM(o.estimated_value), 0)', 'revenue')
      .addSelect('COUNT(*)', 'deals')
      .where('o.tenant_id = :tenantId', { tenantId })
      .andWhere("o.closed_reason = 'won'")
      .groupBy('o.account_id')
      .orderBy('revenue', 'DESC')
      .limit(limit)
      .getRawMany();

    return customers.map((c) => ({
      accountId: c.accountId,
      revenue: Number(c.revenue),
      deals: Number(c.deals),
    }));
  }

  async getAgingDeals(tenantId: string) {
    const deals = await this.oppRepo
      .createQueryBuilder('o')
      .where('o.tenant_id = :tenantId', { tenantId })
      .andWhere('o.closed_reason IS NULL')
      .andWhere('o.expected_close_date < NOW()')
      .orderBy('o.expected_close_date', 'ASC')
      .getMany();

    return deals.map((d) => ({
      id: d.id,
      dealName: d.dealName,
      stageId: d.stageId,
      estimatedValue: d.estimatedValue,
      expectedCloseDate: d.expectedCloseDate,
      daysOverdue: Math.floor(
        (Date.now() - new Date(d.expectedCloseDate).getTime()) / 86400000,
      ),
    }));
  }

  async getSalesForecast(tenantId: string) {
    const stages = await this.stageRepo.find({
      where: { tenantId },
      order: { sortOrder: 'ASC' },
    });

    const forecast = [];
    for (const stage of stages) {
      const opps = await this.oppRepo
        .createQueryBuilder('o')
        .select('COALESCE(SUM(o.estimated_value), 0)', 'total')
        .where('o.tenant_id = :tenantId AND o.stage_id = :stageId', {
          tenantId,
          stageId: stage.id,
        })
        .andWhere('o.closed_reason IS NULL')
        .getRawOne();

      forecast.push({
        stage: stage.name,
        probability: stage.probability,
        totalValue: Number(opps?.total || 0),
        weightedValue: Number(opps?.total || 0) * (stage.probability / 100),
      });
    }

    const totalWeighted = forecast.reduce((s, f) => s + f.weightedValue, 0);
    return { forecast, totalWeightedForecast: totalWeighted };
  }

  private getDateFilter(period: string): Date {
    const now = new Date();
    switch (period) {
      case 'quarter':
        return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      case 'year':
        return new Date(now.getFullYear(), 0, 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }
}
