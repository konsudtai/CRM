import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { Opportunity } from '../../entities/opportunity.entity';
import { StageDto } from './dto/update-stages.dto';

export interface StageSummary {
  stageId: string;
  stageName: string;
  color: string;
  sortOrder: number;
  probability: number;
  totalValue: number;
  weightedValue: number;
  dealCount: number;
}

@Injectable()
export class PipelineService {
  constructor(
    @InjectRepository(PipelineStage)
    private readonly stageRepo: Repository<PipelineStage>,
    @InjectRepository(Opportunity)
    private readonly oppRepo: Repository<Opportunity>,
  ) {}

  async getStages(tenantId: string): Promise<PipelineStage[]> {
    return this.stageRepo.find({
      where: { tenantId },
      order: { sortOrder: 'ASC' },
    });
  }

  async updateStages(tenantId: string, stages: StageDto[]): Promise<PipelineStage[]> {
    // Remove existing stages for tenant
    await this.stageRepo.delete({ tenantId });

    const newStages = stages.map((s) =>
      this.stageRepo.create({
        ...(s.id ? { id: s.id } : {}),
        tenantId,
        name: s.name,
        sortOrder: s.sortOrder,
        probability: s.probability,
        color: s.color ?? '#0071e3',
      }),
    );

    return this.stageRepo.save(newStages);
  }

  async getSummary(tenantId: string): Promise<StageSummary[]> {
    const stages = await this.stageRepo.find({
      where: { tenantId },
      order: { sortOrder: 'ASC' },
    });

    const opportunities = await this.oppRepo.find({
      where: { tenantId },
    });

    return stages.map((stage) => {
      const stageOpps = opportunities.filter((o) => o.stageId === stage.id);
      const totalValue = stageOpps.reduce(
        (sum, o) => sum + Number(o.estimatedValue),
        0,
      );
      const weightedValue = stageOpps.reduce(
        (sum, o) => sum + (Number(o.estimatedValue) * stage.probability) / 100,
        0,
      );

      return {
        stageId: stage.id,
        stageName: stage.name,
        color: stage.color,
        sortOrder: stage.sortOrder,
        probability: stage.probability,
        totalValue: Math.round(totalValue * 100) / 100,
        weightedValue: Math.round(weightedValue * 100) / 100,
        dealCount: stageOpps.length,
      };
    });
  }
}
