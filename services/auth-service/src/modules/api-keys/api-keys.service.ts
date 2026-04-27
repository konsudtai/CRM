import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ApiKey } from '../../entities/api-key.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  /**
   * Generate a new API key for a tenant.
   * Returns the raw key only once — it is stored as a SHA-256 hash.
   */
  async create(
    tenantId: string,
    userId: string,
    dto: CreateApiKeyDto,
  ): Promise<{ id: string; key: string; name: string; keyPrefix: string; expiresAt: Date | null; createdAt: Date }> {
    const rawKey = this.generateKey();
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 8);

    const apiKey = this.apiKeyRepo.create({
      tenantId,
      name: dto.name,
      keyHash,
      keyPrefix,
      status: 'active',
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      createdBy: userId,
    });

    const saved = await this.apiKeyRepo.save(apiKey);

    return {
      id: saved.id,
      key: rawKey, // Only returned once at creation time
      name: saved.name,
      keyPrefix: saved.keyPrefix,
      expiresAt: saved.expiresAt,
      createdAt: saved.createdAt,
    };
  }

  /**
   * List all API keys for a tenant (without the raw key).
   */
  async findAll(tenantId: string): Promise<ApiKey[]> {
    return this.apiKeyRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Revoke (soft-delete) an API key.
   */
  async revoke(tenantId: string, keyId: string): Promise<void> {
    const apiKey = await this.apiKeyRepo.findOne({
      where: { id: keyId, tenantId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    apiKey.status = 'revoked';
    await this.apiKeyRepo.save(apiKey);
  }

  private generateKey(): string {
    return `crm_${crypto.randomBytes(32).toString('hex')}`;
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}
