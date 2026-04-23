import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../providers/redis.provider';

/**
 * Redis-based sliding window rate limiter.
 * Allows 1000 requests per minute per tenant.
 * Returns HTTP 429 with Retry-After header when exceeded.
 */
@Injectable()
export class RateLimiterGuard implements CanActivate {
  private readonly logger = new Logger(RateLimiterGuard.name);
  private readonly WINDOW_SIZE_MS = 60_000; // 1 minute
  private readonly MAX_REQUESTS = 1000;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const tenantId = (request as any).user?.tenantId;

    if (!tenantId) {
      // No tenant context — skip rate limiting (auth guard should catch this)
      return true;
    }

    const key = `ratelimit:${tenantId}`;
    const now = Date.now();
    const windowStart = now - this.WINDOW_SIZE_MS;

    // Sliding window using Redis sorted set
    const pipeline = this.redis.pipeline();
    // Remove entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart);
    // Count entries in the window
    pipeline.zcard(key);
    // Add current request
    pipeline.zadd(key, now.toString(), `${now}:${Math.random()}`);
    // Set TTL on the key
    pipeline.expire(key, 60);

    const results = await pipeline.exec();
    // results[1] is the zcard result: [error, count]
    const currentCount = (results?.[1]?.[1] as number) || 0;

    if (currentCount >= this.MAX_REQUESTS) {
      // Calculate retry-after in seconds
      const oldestInWindow = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      let retryAfter = 60;
      if (oldestInWindow.length >= 2) {
        const oldestTimestamp = parseInt(oldestInWindow[1], 10);
        retryAfter = Math.ceil((oldestTimestamp + this.WINDOW_SIZE_MS - now) / 1000);
        if (retryAfter < 1) retryAfter = 1;
      }

      response.setHeader('Retry-After', retryAfter.toString());
      this.logger.warn(`Rate limit exceeded for tenant ${tenantId}: ${currentCount} requests`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Maximum ${this.MAX_REQUESTS} requests per minute.`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
