import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { IpAllowlistGuard } from './ip-allowlist.guard';

/**
 * Unit tests for IpAllowlistGuard.
 * Validates: Requirements 15.3 (IP allowlisting per tenant)
 */
describe('IpAllowlistGuard', () => {
  let guard: IpAllowlistGuard;
  let mockIpAllowlistRepo: any;
  let mockTenantRepo: any;
  let mockRedis: any;

  const tenantId = '11111111-1111-1111-1111-111111111111';

  function createMockContext(
    ip: string,
    user?: { tenantId: string },
    headers: Record<string, string> = {},
  ): ExecutionContext {
    const request = {
      ip,
      headers,
      socket: { remoteAddress: ip },
      user,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    mockIpAllowlistRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    mockTenantRepo = {
      findOne: jest.fn(),
    };

    guard = new IpAllowlistGuard(
      mockIpAllowlistRepo,
      mockTenantRepo,
      mockRedis,
    );
  });

  describe('canActivate', () => {
    it('should allow request when no user context is present', async () => {
      const ctx = createMockContext('127.0.0.1');
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('should allow request when IP allowlisting is disabled for tenant', async () => {
      mockTenantRepo.findOne.mockResolvedValue({
        id: tenantId,
        settings: { ipAllowlistEnabled: false },
      });

      const ctx = createMockContext('192.168.1.100', { tenantId });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('should allow request when IP allowlisting is enabled but no entries exist', async () => {
      mockTenantRepo.findOne.mockResolvedValue({
        id: tenantId,
        settings: { ipAllowlistEnabled: true },
      });
      mockIpAllowlistRepo.find.mockResolvedValue([]);

      const ctx = createMockContext('192.168.1.100', { tenantId });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('should allow request when client IP matches an exact allowlist entry', async () => {
      mockTenantRepo.findOne.mockResolvedValue({
        id: tenantId,
        settings: { ipAllowlistEnabled: true },
      });
      mockIpAllowlistRepo.find.mockResolvedValue([
        { address: '10.0.0.5' },
        { address: '192.168.1.100' },
      ]);

      const ctx = createMockContext('192.168.1.100', { tenantId });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('should allow request when client IP matches a CIDR range', async () => {
      mockTenantRepo.findOne.mockResolvedValue({
        id: tenantId,
        settings: { ipAllowlistEnabled: true },
      });
      mockIpAllowlistRepo.find.mockResolvedValue([
        { address: '10.0.0.0/8' },
      ]);

      const ctx = createMockContext('10.5.3.200', { tenantId });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('should deny request when client IP is not in the allowlist', async () => {
      mockTenantRepo.findOne.mockResolvedValue({
        id: tenantId,
        settings: { ipAllowlistEnabled: true },
      });
      mockIpAllowlistRepo.find.mockResolvedValue([
        { address: '10.0.0.1' },
        { address: '192.168.1.0/24' },
      ]);

      const ctx = createMockContext('172.16.0.50', { tenantId });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('should use x-forwarded-for header when present', async () => {
      mockTenantRepo.findOne.mockResolvedValue({
        id: tenantId,
        settings: { ipAllowlistEnabled: true },
      });
      mockIpAllowlistRepo.find.mockResolvedValue([
        { address: '203.0.113.50' },
      ]);

      const ctx = createMockContext('127.0.0.1', { tenantId }, {
        'x-forwarded-for': '203.0.113.50, 10.0.0.1',
      });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('should use cached values from Redis when available', async () => {
      // Cache says enabled
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('ip_allowlist_enabled')) return Promise.resolve('1');
        if (key.includes('ip_allowlist')) return Promise.resolve(JSON.stringify(['192.168.1.0/24']));
        return Promise.resolve(null);
      });

      const ctx = createMockContext('192.168.1.50', { tenantId });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      // Should not hit the database
      expect(mockTenantRepo.findOne).not.toHaveBeenCalled();
      expect(mockIpAllowlistRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('matchIp', () => {
    it('should match exact IPv4 addresses', () => {
      expect(guard.matchIp('192.168.1.1', '192.168.1.1')).toBe(true);
      expect(guard.matchIp('192.168.1.1', '192.168.1.2')).toBe(false);
    });

    it('should match CIDR /24 range', () => {
      expect(guard.matchIp('192.168.1.100', '192.168.1.0/24')).toBe(true);
      expect(guard.matchIp('192.168.1.255', '192.168.1.0/24')).toBe(true);
      expect(guard.matchIp('192.168.2.1', '192.168.1.0/24')).toBe(false);
    });

    it('should match CIDR /16 range', () => {
      expect(guard.matchIp('10.0.5.3', '10.0.0.0/16')).toBe(true);
      expect(guard.matchIp('10.1.0.1', '10.0.0.0/16')).toBe(false);
    });

    it('should match CIDR /8 range', () => {
      expect(guard.matchIp('10.255.255.255', '10.0.0.0/8')).toBe(true);
      expect(guard.matchIp('11.0.0.1', '10.0.0.0/8')).toBe(false);
    });

    it('should match CIDR /32 (single host)', () => {
      expect(guard.matchIp('192.168.1.1', '192.168.1.1/32')).toBe(true);
      expect(guard.matchIp('192.168.1.2', '192.168.1.1/32')).toBe(false);
    });

    it('should handle IPv6-mapped IPv4 addresses', () => {
      expect(guard.matchIp('::ffff:192.168.1.1', '192.168.1.1')).toBe(true);
      expect(guard.matchIp('192.168.1.1', '::ffff:192.168.1.1')).toBe(true);
    });

    it('should handle CIDR /0 (match all)', () => {
      expect(guard.matchIp('1.2.3.4', '0.0.0.0/0')).toBe(true);
      expect(guard.matchIp('255.255.255.255', '0.0.0.0/0')).toBe(true);
    });
  });

  describe('invalidateCache', () => {
    it('should delete both cache keys for the tenant', async () => {
      await guard.invalidateCache(tenantId);
      expect(mockRedis.del).toHaveBeenCalledWith(`tenant:${tenantId}:ip_allowlist`);
      expect(mockRedis.del).toHaveBeenCalledWith(`tenant:${tenantId}:ip_allowlist_enabled`);
    });
  });
});
