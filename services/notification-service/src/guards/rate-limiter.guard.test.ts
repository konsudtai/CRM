import { RateLimiterGuard } from './rate-limiter.guard';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('RateLimiterGuard', () => {
  let guard: RateLimiterGuard;
  let mockRedis: any;

  const createMockContext = (tenantId?: string) => {
    const mockResponse = {
      setHeader: jest.fn(),
    };
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: tenantId ? { tenantId } : undefined,
        }),
        getResponse: () => mockResponse,
      }),
      mockResponse,
    };
  };

  beforeEach(() => {
    mockRedis = {
      pipeline: jest.fn(),
      zrange: jest.fn().mockResolvedValue([]),
    };
  });

  it('should allow requests when under the limit', async () => {
    const mockPipeline = {
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 0],   // zremrangebyscore
        [null, 50],  // zcard — 50 requests in window
        [null, 1],   // zadd
        [null, 1],   // expire
      ]),
    };
    mockRedis.pipeline.mockReturnValue(mockPipeline);

    guard = new RateLimiterGuard(mockRedis);
    const ctx = createMockContext('tenant-1');

    const result = await guard.canActivate(ctx as any);
    expect(result).toBe(true);
  });

  it('should reject requests when at the limit (1000)', async () => {
    const mockPipeline = {
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 0],
        [null, 1000], // at limit
        [null, 1],
        [null, 1],
      ]),
    };
    mockRedis.pipeline.mockReturnValue(mockPipeline);
    mockRedis.zrange.mockResolvedValue([
      'entry',
      String(Date.now() - 30000), // 30s ago
    ]);

    guard = new RateLimiterGuard(mockRedis);
    const ctx = createMockContext('tenant-1');

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(HttpException);

    try {
      await guard.canActivate(ctx as any);
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(ctx.mockResponse.setHeader).toHaveBeenCalledWith(
        'Retry-After',
        expect.any(String),
      );
    }
  });

  it('should skip rate limiting when no tenant context', async () => {
    guard = new RateLimiterGuard(mockRedis);
    const ctx = createMockContext(); // no tenantId

    const result = await guard.canActivate(ctx as any);
    expect(result).toBe(true);
    expect(mockRedis.pipeline).not.toHaveBeenCalled();
  });

  it('should allow request 999 and reject request 1000', async () => {
    // Under limit
    const underPipeline = {
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 0],
        [null, 999],
        [null, 1],
        [null, 1],
      ]),
    };
    mockRedis.pipeline.mockReturnValue(underPipeline);

    guard = new RateLimiterGuard(mockRedis);
    const ctx = createMockContext('tenant-1');

    const result = await guard.canActivate(ctx as any);
    expect(result).toBe(true);

    // At limit
    const atLimitPipeline = {
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 0],
        [null, 1000],
        [null, 1],
        [null, 1],
      ]),
    };
    mockRedis.pipeline.mockReturnValue(atLimitPipeline);
    mockRedis.zrange.mockResolvedValue(['entry', String(Date.now())]);

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(HttpException);
  });
});
