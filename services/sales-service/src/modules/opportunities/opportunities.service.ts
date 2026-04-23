import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity } from '../../entities/opportunity.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { OpportunityHistory } from '../../entities/opportunity-history.entity';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { CloseOpportunityDto } from './dto/close-opportunity.dto';

@Injectable()
export class OpportunitiesService {
  constructor(
    @InjectRepository(Opportunity)
    private readonly oppRepo: Repository<Opportunity>,
    @InjectRepository(PipelineStage)
    private readonly stageRepo: Repository<PipelineStage>,
    @InjectRepository(OpportunityHistory)
    private readonly historyRepo: Repository<OpportunityHistory>,
  ) {}

  async create(tenantId: string, dto: CreateOpportunityDto): Promise<Opportunity> {
    const stage = await this.stageRepo.findOne({
      where: { id: dto.stageId, tenantId },
    });
    if (!stage) {
      throw new BadRequestException('Invalid pipeline stage');
    }

    const weightedValue = this.calculateWeightedValue(
      dto.estimatedValue,
      stage.probability,
    );

    const opp = this.oppRepo.create({
      tenantId,
      dealName: dto.dealName,
      accountId: dto.accountId,
      contactId: dto.contactId ?? null,
      estimatedValue: dto.estimatedValue,
      stageId: dto.stageId,
      weightedValue,
      expectedCloseDate: dto.expectedCloseDate,
      assignedTo: dto.assignedTo,
    });

    return this.oppRepo.save(opp);
  }

  async findAll(
    tenantId: string,
    page = 1,
    limit = 20,
    stageId?: string,
  ): Promise<{ data: Opportunity[]; total: number; page: number; limit: number }> {
    const where: any = { tenantId };
    if (stageId) {
      where.stageId = stageId;
    }

    const [data, total] = await this.oppRepo.findAndCount({
      where,
      relations: ['stage'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string): Promise<Opportunity> {
    const opp = await this.oppRepo.findOne({
      where: { id, tenantId },
      relations: ['stage', 'history'],
    });
    if (!opp) {
      throw new NotFoundException('Opportunity not found');
    }
    return opp;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateOpportunityDto,
    userId: string,
  ): Promise<Opportunity> {
    const opp = await this.findOne(tenantId, id);
    const changes: Partial<OpportunityHistory>[] = [];

    if (dto.dealName !== undefined && dto.dealName !== opp.dealName) {
      changes.push({ fieldName: 'dealName', oldValue: opp.dealName, newValue: dto.dealName });
      opp.dealName = dto.dealName;
    }
    if (dto.estimatedValue !== undefined && Number(dto.estimatedValue) !== Number(opp.estimatedValue)) {
      changes.push({
        fieldName: 'estimatedValue',
        oldValue: String(opp.estimatedValue),
        newValue: String(dto.estimatedValue),
      });
      opp.estimatedValue = dto.estimatedValue;
      // Recalculate weighted value with current stage probability
      const stage = await this.stageRepo.findOne({ where: { id: opp.stageId, tenantId } });
      if (stage) {
        opp.weightedValue = this.calculateWeightedValue(dto.estimatedValue, stage.probability);
      }
    }
    if (dto.accountId !== undefined) opp.accountId = dto.accountId;
    if (dto.contactId !== undefined) opp.contactId = dto.contactId;
    if (dto.expectedCloseDate !== undefined) opp.expectedCloseDate = dto.expectedCloseDate as any;
    if (dto.assignedTo !== undefined) opp.assignedTo = dto.assignedTo;

    if (changes.length > 0) {
      await this.recordHistory(opp.id, changes, userId);
    }

    return this.oppRepo.save(opp);
  }

  async updateStage(
    tenantId: string,
    id: string,
    dto: UpdateStageDto,
    userId: string,
  ): Promise<Opportunity> {
    const opp = await this.findOne(tenantId, id);
    const newStage = await this.stageRepo.findOne({
      where: { id: dto.stageId, tenantId },
    });
    if (!newStage) {
      throw new BadRequestException('Invalid pipeline stage');
    }

    const oldStageId = opp.stageId;
    opp.stageId = dto.stageId;
    opp.weightedValue = this.calculateWeightedValue(
      Number(opp.estimatedValue),
      newStage.probability,
    );

    await this.recordHistory(opp.id, [
      { fieldName: 'stageId', oldValue: oldStageId, newValue: dto.stageId },
      {
        fieldName: 'weightedValue',
        oldValue: String(opp.weightedValue),
        newValue: String(opp.weightedValue),
      },
    ], userId);

    return this.oppRepo.save(opp);
  }

  async close(
    tenantId: string,
    id: string,
    dto: CloseOpportunityDto,
    userId: string,
  ): Promise<Opportunity> {
    const opp = await this.findOne(tenantId, id);

    if (!dto.reason || dto.reason.trim() === '') {
      throw new BadRequestException('Reason is required when closing an opportunity');
    }

    // Find the Won or Lost stage
    const closedStage = await this.stageRepo.findOne({
      where: { tenantId, name: dto.outcome },
    });

    const oldStageId = opp.stageId;
    if (closedStage) {
      opp.stageId = closedStage.id;
      opp.weightedValue = this.calculateWeightedValue(
        Number(opp.estimatedValue),
        closedStage.probability,
      );
    }

    opp.closedReason = dto.reason;
    opp.closedNotes = dto.notes ?? null;

    await this.recordHistory(opp.id, [
      { fieldName: 'stageId', oldValue: oldStageId, newValue: opp.stageId },
      { fieldName: 'closedReason', oldValue: null, newValue: dto.reason },
    ], userId);

    return this.oppRepo.save(opp);
  }

  calculateWeightedValue(estimatedValue: number, probability: number): number {
    return Math.round((estimatedValue * probability) / 100 * 100) / 100;
  }

  private async recordHistory(
    opportunityId: string,
    changes: Partial<OpportunityHistory>[],
    changedBy: string,
  ): Promise<void> {
    const records = changes.map((c) =>
      this.historyRepo.create({
        opportunityId,
        fieldName: c.fieldName!,
        oldValue: c.oldValue ?? null,
        newValue: c.newValue ?? null,
        changedBy,
      }),
    );
    await this.historyRepo.save(records);
  }
}
