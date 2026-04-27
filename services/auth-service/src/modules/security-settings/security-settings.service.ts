import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { IpAllowlistEntry } from '../../entities/ip-allowlist-entry.entity';
import { IpAllowlistGuard } from '../../guards/ip-allowlist.guard';
import { AddIpAllowlistDto } from './dto/add-ip-allowlist.dto';

@Injectable()
export class SecuritySettingsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(IpAllowlistEntry)
    private readonly ipAllowlistRepo: Repository<IpAllowlistEntry>,
    private readonly ipAllowlistGuard: IpAllowlistGuard,
  ) {}

  async getSecuritySettings(tenantId: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const settings = (tenant.settings || {}) as Record<string, unknown>;
    const ipEntries = await this.ipAllowlistRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });

    return {
      mfaRequired: settings.mfaRequired === true,
      ipAllowlistEnabled: settings.ipAllowlistEnabled === true,
      ipAllowlist: ipEntries,
    };
  }

  async updateMfaSetting(tenantId: string, mfaRequired: boolean) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    tenant.settings = { ...(tenant.settings || {}), mfaRequired };
    await this.tenantRepo.save(tenant);

    return { mfaRequired };
  }

  async toggleIpAllowlist(tenantId: string, enabled: boolean) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    tenant.settings = { ...(tenant.settings || {}), ipAllowlistEnabled: enabled };
    await this.tenantRepo.save(tenant);
    await this.ipAllowlistGuard.invalidateCache(tenantId);

    return { ipAllowlistEnabled: enabled };
  }

  async addIpAllowlistEntry(tenantId: string, dto: AddIpAllowlistDto) {
    const entry = this.ipAllowlistRepo.create({
      tenantId,
      address: dto.address,
      description: dto.description || null,
    });
    const saved = await this.ipAllowlistRepo.save(entry);
    await this.ipAllowlistGuard.invalidateCache(tenantId);
    return saved;
  }

  async removeIpAllowlistEntry(tenantId: string, entryId: string) {
    const entry = await this.ipAllowlistRepo.findOne({
      where: { id: entryId, tenantId },
    });
    if (!entry) throw new NotFoundException('IP allowlist entry not found');

    await this.ipAllowlistRepo.remove(entry);
    await this.ipAllowlistGuard.invalidateCache(tenantId);
  }
}
