import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesTarget } from '../../entities/sales-target.entity';
import { Opportunity } from '../../entities/opportunity.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { CreateTargetDto } from './dto/create-target.dto';

export interface TargetWithProgress extends SalesTarget {
  progress: number;
}

@Injectable()
export class TargetsService {
  constructor(
    @InjectRepository(SalesTarget)
    private readonly targetRepo: Repository<SalesTarget>,
    @InjectRepository(Opportunity)
    private readonly oppRepo: Repository<Opportunity>,
    @InjectRepository(PipelineStage)
    private readonly stageRepo: Repository<PipelineStage>,
  ) {}

  async create(tenantId: string, dto: CreateTargetDto): Promise<SalesTarget> {
    if (dto.period === 'monthly' && (dto.month === undefined || dto.month === null)) {
      throw new BadRequestException('month is required for monthly targets');
    }
    if (dto.period === 'quarterly' && (dto.quarter === undefined || dto.quarter === null)) {
      throw new BadRequestException('quarter is required for quarterly targets');
    }

    const target = this.targetRepo.create({
      tenantId,
      userId: dto.userId,
      period: dto.period,
      year: dto.year,
      month: dto.month ?? null,
      quarter: dto.quarter ?? null,
      targetAmount: dto.targetAmount,
      achievedAmount: 0,
    });

    return this.targetRepo.save(target);
  }

  async findAll(tenantId: string): Promise<TargetWithProgress[]> {
    const targets = await this.targetRepo.find({
      where: { tenantId },
      order: { year: 'DESC', month: 'ASC', quarter: 'ASC' },
    });

    // Find the "Won" stage for this tenant
    const wonStage = await this.stageRepo.findOne({
      where: { tenantId, name: 'Won' },
    });

    if (!wonStage) {
      return targets.map((t) => ({ ...t, progress: 0 }));
    }

    // Get all closed-won opportunities
    const wonOpps = await this.oppRepo.find({
      where: { tenantId, stageId: wonStage.id },
    });

    return targets.map((target) => {
      const relevantOpps = wonOpps.filter((opp) => {
        if (opp.assignedTo !== target.userId) return false;
        const closeDate = new Date(opp.updatedAt);
        if (closeDate.getFullYear() !== target.year) return false;

        if (target.period === 'monthly') {
          return closeDate.getMonth() + 1 === target.month;
        }
        if (target.period === 'quarterly' && target.quarter) {
          const oppQuarter = Math.ceil((closeDate.getMonth() + 1) / 3);
          return oppQuarter === target.quarter;
        }
        return false;
      });

      const achievedAmount = relevantOpps.reduce(
        (sum, o) => sum + Number(o.estimatedValue),
        0,
      );

      const progress =
        Number(target.targetAmount) > 0
          ? Math.round((achievedAmount / Number(target.targetAmount)) * 10000) / 100
          : 0;

      return { ...target, achievedAmount, progress };
    });
  }
}
