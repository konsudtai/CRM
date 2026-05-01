import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Request } from 'express';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../providers/redis.provider';
import { ApiKey } from '../entities/api-key.entity';

/**
 * GatewayAuthGuard supports multiple authentication methods:
 * 1. JWT Bearer token (Authorization: Bearer <jwt>)
 * 2. API Key (X-API-Key: <key>)
 * 3. OAuth 2.0 Bearer token (same as JWT — tokens issued via OAuth flow)
 *
 * This guard is applied globally on all routes. It validates the token,
 * extracts tenant context, and sets the PostgreSQL RLS session variable.
 */
@Injectable()
export class GatewayAuthGuard implements CanActivate {
  private readonly logger = new Logger(GatewayAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Try API key first (X-API-Key header)
    const apiKeyHeader = request.headers['x-api-key'] as string | undefined;
    if (apiKeyHeader) {
      return this.validateApiKey(request, apiKeyHeader);
    }

    // Try Bearer token (JWT or OAuth 2.0)
    const bearerToken = this.extractBearerToken(request);
    if (bearerToken) {
      return this.validateBearerToken(request, bearerToken);
    }

    throw new UnauthorizedException(
      'Missing authentication. Provide Authorization: Bearer <token> or X-API-Key header.',
    );
  }

  private async validateBearerToken(
    request: Request,
    token: string,
  ): Promise<boolean> {
    // Check blacklist
    const isBlacklisted = await this.redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    let payload: { sub: string; tenantId: string };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload.tenantId) {
      throw new UnauthorizedException('Token missing tenant identifier');
    }

    // Set PostgreSQL RLS session variable (parameterized to prevent SQL injection)
    await this.dataSource.query(
      `SELECT set_config('app.current_tenant', $1, true)`, [payload.tenantId],
    );

    (request as any).user = payload;
    return true;
  }

  private async validateApiKey(
    request: Request,
    key: string,
  ): Promise<boolean> {
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    const apiKey = await this.apiKeyRepo.findOne({
      where: { keyHash, status: 'active' },
    });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    // Update last used (fire-and-forget)
    this.apiKeyRepo
      .update(apiKey.id, { lastUsedAt: new Date() })
      .catch((err) =>
        this.logger.error('Failed to update API key last_used_at', err),
      );

    // Set PostgreSQL RLS session variable (parameterized to prevent SQL injection)
    await this.dataSource.query(
      `SELECT set_config('app.current_tenant', $1, true)`, [apiKey.tenantId],
    );

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

  private extractBearerToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) return undefined;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
