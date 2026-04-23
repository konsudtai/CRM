import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike } from 'typeorm';
import { Lead } from '../../entities/lead.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { ImportLeadRowDto } from './dto/import-leads.dto';
import { BulkAction } from './dto/bulk-leads.dto';
import { LeadAssignmentService } from './lead-assignment.service';

export interface ImportResult {
  created: number;
  errors: { row: number; messages: string[] }[];
}

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(PipelineStage)
    private readonly stageRepo: Repository<PipelineStage>,
    private readonly assignmentService: LeadAssignmentService,
  ) {}

  async create(tenantId: string, dto: CreateLeadDto): Promise<Lead> {
    let assignedTo: string | null = null;

    if (dto.autoAssign && dto.activeRepIds && dto.activeRepIds.length > 0) {
      const nextRep = await this.assignmentService.getNextRep(tenantId, dto.activeRepIds);
      assignedTo = nextRep;
    }

    const lead = this.leadRepo.create({
      tenantId,
      name: dto.name,
      companyName: dto.companyName ?? null,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      lineId: dto.lineId ?? null,
      source: dto.source,
      status: 'New',
      assignedTo,
      metadata: { statusHistory: [{ status: 'New', timestamp: new Date().toISOString() }] },
    });
    return this.leadRepo.save(lead);
  }

  async importLeads(tenantId: string, rows: ImportLeadRowDto[]): Promise<ImportResult> {
    const errors: { row: number; messages: string[] }[] = [];
    const validLeads: Partial<Lead>[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowErrors: string[] = [];

      if (!row.name || row.name.trim() === '') {
        rowErrors.push('name is required');
      }
      if ((!row.phone || row.phone.trim() === '') && (!row.email || row.email.trim() === '')) {
        rowErrors.push('phone or email is required');
      }

      if (rowErrors.length > 0) {
        errors.push({ row: i + 1, messages: rowErrors });
      } else {
        validLeads.push({
          tenantId,
          name: row.name!,
          companyName: row.companyName ?? null,
          email: row.email ?? null,
          phone: row.phone ?? null,
          lineId: row.lineId ?? null,
          source: row.source || 'import',
          status: 'New',
          metadata: { statusHistory: [{ status: 'New', timestamp: new Date().toISOString() }] },
        });
      }
    }

    if (validLeads.length > 0) {
      await this.leadRepo.save(validLeads.map((l) => this.leadRepo.create(l)));
    }

    return { created: validLeads.length, errors };
  }

  async findAll(
    tenantId: string,
    page = 1,
    limit = 20,
    status?: string,
    search?: string,
  ): Promise<{ data: Lead[]; total: number; page: number; limit: number }> {
    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }

    const [data, total] = await this.leadRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string): Promise<Lead> {
    const lead = await this.leadRepo.findOne({ where: { id, tenantId } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  async update(tenantId: string, id: string, dto: UpdateLeadDto): Promise<Lead> {
    const lead = await this.findOne(tenantId, id);
    Object.assign(lead, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.companyName !== undefined && { companyName: dto.companyName }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.lineId !== undefined && { lineId: dto.lineId }),
      ...(dto.source !== undefined && { source: dto.source }),
    });
    return this.leadRepo.save(lead);
  }

  async updateStatus(
    tenantId: string,
    id: string,
    dto: UpdateLeadStatusDto,
    userId: string,
  ): Promise<Lead> {
    const lead = await this.findOne(tenantId, id);
    const previousStatus = lead.status;
    lead.status = dto.status;

    const history = (lead.metadata?.statusHistory as any[]) || [];
    history.push({
      from: previousStatus,
      to: dto.status,
      userId,
      timestamp: new Date().toISOString(),
    });
    lead.metadata = { ...lead.metadata, statusHistory: history };

    return this.leadRepo.save(lead);
  }

  async assign(tenantId: string, id: string, userId: string): Promise<Lead> {
    const lead = await this.findOne(tenantId, id);
    lead.assignedTo = userId;
    return this.leadRepo.save(lead);
  }

  async bulk(
    tenantId: string,
    action: BulkAction,
    leadIds: string[],
    value: string,
    userId: string,
  ): Promise<{ affected: number }> {
    const leads = await this.leadRepo.find({
      where: { tenantId, id: In(leadIds) },
    });

    if (leads.length === 0) {
      throw new BadRequestException('No matching leads found');
    }

    switch (action) {
      case BulkAction.ASSIGN:
        for (const lead of leads) {
          lead.assignedTo = value;
        }
        await this.leadRepo.save(leads);
        break;

      case BulkAction.STATUS:
        for (const lead of leads) {
          const history = (lead.metadata?.statusHistory as any[]) || [];
          history.push({
            from: lead.status,
            to: value,
            userId,
            timestamp: new Date().toISOString(),
          });
          lead.status = value;
          lead.metadata = { ...lead.metadata, statusHistory: history };
        }
        await this.leadRepo.save(leads);
        break;

      case BulkAction.DELETE:
        await this.leadRepo.remove(leads);
        break;
    }

    return { affected: leads.length };
  }

  async seedDefaultStages(tenantId: string): Promise<PipelineStage[]> {
    const existing = await this.stageRepo.find({ where: { tenantId } });
    if (existing.length > 0) {
      return existing;
    }

    const defaults = [
      { name: 'New', sortOrder: 1, probability: 10, color: '#007AFF' },
      { name: 'Contacted', sortOrder: 2, probability: 20, color: '#5856D6' },
      { name: 'Qualified', sortOrder: 3, probability: 40, color: '#FF9500' },
      { name: 'Proposal', sortOrder: 4, probability: 60, color: '#34C759' },
      { name: 'Negotiation', sortOrder: 5, probability: 80, color: '#FF3B30' },
      { name: 'Won', sortOrder: 6, probability: 100, color: '#30D158' },
      { name: 'Lost', sortOrder: 7, probability: 0, color: '#8E8E93' },
    ];

    const stages = defaults.map((d) =>
      this.stageRepo.create({ tenantId, ...d }),
    );
    return this.stageRepo.save(stages);
  }
}
