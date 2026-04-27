import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import * as crypto from 'crypto';
import { ApiKey } from '../entities/api-key.entity';

/**
 * ApiKeyGuard validates requests authenticated via the X-API-Key header.
 * Used for external API access alongside JWT/OAuth bearer tokens.
 *
 * The guard hashes the provided key and looks it up in the api_keys table.
 * If found and active (not expired), it attaches tenant context to the request.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKeyHeader = request.headers['x-api-key'] as string | undefined;

    if (!apiKeyHeader) {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    const keyHash = this.hashKey(apiKeyHeader);

    const apiKey = await this.apiKeyRepo.findOne({
      where: { keyHash, status: 'active' },
    });

    if (!apiKey) {
      this.logger.warn('Invalid API key attempt');
      throw new UnauthorizedException('Invalid API key');
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      this.logger.warn(`Expired API key used: ${apiKey.keyPrefix}...`);
      throw new UnauthorizedException('API key has expired');
    }

    // Update last used timestamp (fire-and-forget)
    this.apiKeyRepo
      .update(apiKey.id, { lastUsedAt: new Date() })
      .catch((err) => this.logger.error('Failed to update API key last_used_at', err));

    // Attach tenant context to request (similar to TenantGuard)
    (request as any).user = {
      sub: apiKey.createdBy,
      tenantId: apiKey.tenantId,
      roles: [],
      permissions: [],
      isApiKey: true,
      apiKeyId: apiKey.id,
    };

    return true;
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}
