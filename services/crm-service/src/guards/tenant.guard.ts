import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { Request } from 'express';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../providers/redis.provider';

/**
 * TenantGuard extracts tenant_id from the JWT and sets the PostgreSQL
 * session variable `app.current_tenant` so that RLS policies can enforce
 * tenant isolation on every query.
 *
 * Also checks the Redis blacklist to reject logged-out tokens.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    // Check blacklist before verifying
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

    // Set the PostgreSQL session variable for RLS enforcement
    await this.dataSource.query(
      `SET LOCAL app.current_tenant = '${payload.tenantId}'`,
    );

    // Attach user info to request for downstream handlers
    (request as any).user = payload;

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) return undefined;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
