import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { RateLimiterGuard } from './rate-limiter.guard';

describe('RateLimiterGuard', () => {
  let guard: RateLimiterGuard;
  let mockRedis: {
    pipeline: jest.Mock;
    zrange: jest.Mock;
  };
  let mockPipeline: {
    zremrangebyscore: jest.Mock;
    zcard: jest.Mock;
    zadd: jest.Mock;
    expire: jest.Mock;
    exec: jest.Mock;
  };

  beforeEach(() => {
    mockPipeline = {
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };
    mockRedis = {
      pipeline: jest.fn().mockReturnValue(mockPipeline),
      zrange: jest.fn(),
    };
    guard = new RateLimiterGuard(mockRedis as any);
  });

  function createMockContext(
    tenantId?: string,
  ): { context: ExecutionContext; response: { setHeader: jest.Mock } } {
    const response = { setHeader: jest.fn() };
    const request = { user: tenantId ? { tenantId } : undefined } as any;
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ExecutionContext;
    return { context, response };
  }

  it('should allow requests under the rate limit', async () => {
    mockPipeline.exec.mockResolvedValue([
      [null, 0],   // zremrangebyscore
      [null, 500], // zcard — 500 requests in window
      [null, 1],   // zadd
      [null, 1],   // expire
    ]);

    const { context } = createMockContext('tenant-1');
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should reject requests exceeding the rate limit with HTTP 429', async () => {
    mockPipeline.exec.mockResolvedValue([
      [null, 0],    // zremrangebyscore
      [null, 1000], // zcard — at limit
      [null, 1],    // zadd
      [null, 1],    // expire
    ]);
    mockRedis.zrange.mockResolvedValue([
      'oldest-entry',
      String(Date.now() - 30_000), // 30 seconds ago
    ]);

    const { context, response } = createMockContext('tenant-1');

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);

    try {
      await guard.canActivate(context);
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(response.setHeader).toHaveBeenCalledWith(
        'Retry-After',
        expect.any(String),
      );
    }
  });

  it('should skip rate limiting when no tenant context is present', async () => {
    const { context } = createMockContext(undefined);
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockRedis.pipeline).not.toHaveBeenCalled();
  });
});
