import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async findAll(): Promise<Tenant[]> {
    return this.tenantRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async create(name: string, slug: string, settings?: Record<string, unknown>): Promise<Tenant> {
    const existing = await this.tenantRepo.findOne({ where: { slug } });
    if (existing) throw new ConflictException('Slug already exists');
    const tenant = this.tenantRepo.create({ name, slug, settings: settings || {}, isActive: true });
    return this.tenantRepo.save(tenant);
  }

  async update(id: string, dto: { name?: string; isActive?: boolean; settings?: Record<string, unknown> }): Promise<Tenant> {
    const tenant = await this.findOne(id);
    if (dto.name !== undefined) tenant.name = dto.name;
    if (dto.isActive !== undefined) tenant.isActive = dto.isActive;
    if (dto.settings !== undefined) tenant.settings = { ...tenant.settings, ...dto.settings };
    return this.tenantRepo.save(tenant);
  }

  async updateLineConfig(id: string, channelToken: string, channelSecret: string): Promise<Tenant> {
    const tenant = await this.findOne(id);
    tenant.lineChannelToken = channelToken;
    tenant.lineChannelSecret = channelSecret;
    return this.tenantRepo.save(tenant);
  }
}
