import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GatewayAuthGuard } from './gateway-auth.guard';
import * as crypto from 'crypto';

describe('GatewayAuthGuard', () => {
  let guard: GatewayAuthGuard;
  let mockJwtService: { verifyAsync: jest.Mock };
  let mockDataSource: { query: jest.Mock };
  let mockRedis: { get: jest.Mock };
  let mockApiKeyRepo: { findOne: jest.Mock; update: jest.Mock };

  beforeEach(() => {
    mockJwtService = { verifyAsync: jest.fn() };
    mockDataSource = { query: jest.fn() };
    mockRedis = { get: jest.fn() };
    mockApiKeyRepo = { findOne: jest.fn(), update: jest.fn().mockResolvedValue({}) };

    guard = new GatewayAuthGuard(
      mockJwtService as any,
      mockDataSource as any,
      mockRedis as any,
      mockApiKeyRepo as any,
    );
  });

  function createMockContext(headers: Record<string, string> = {}): ExecutionContext {
    const request = { headers } as any;
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
    } as ExecutionContext;
  }

  describe('JWT Bearer token authentication', () => {
    it('should authenticate with a valid JWT bearer token', async () => {
      const payload = { sub: 'user-1', tenantId: 'tenant-1', roles: ['Admin'], permissions: ['leads:read'] };
      mockJwtService.verifyAsync.mockResolvedValue(payload);
      mockRedis.get.mockResolvedValue(null);

      const context = createMockContext({ authorization: 'Bearer valid-jwt-token' });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-jwt-token');
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant-1'),
      );
    });

    it('should reject a blacklisted JWT token', async () => {
      mockRedis.get.mockResolvedValue('1');

      const context = createMockContext({ authorization: 'Bearer blacklisted-token' });
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject an invalid JWT token', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockJwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

      const context = createMockContext({ authorization: 'Bearer invalid-token' });
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a JWT without tenantId', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });

      const context = createMockContext({ authorization: 'Bearer no-tenant-token' });
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('API Key authentication', () => {
    it('should authenticate with a valid API key', async () => {
      const rawKey = 'crm_test1234567890abcdef';
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      mockApiKeyRepo.findOne.mockResolvedValue({
        id: 'key-1',
        tenantId: 'tenant-2',
        keyHash,
        keyPrefix: 'crm_test',
        status: 'active',
        expiresAt: null,
        createdBy: 'user-2',
      });

      const context = createMockContext({ 'x-api-key': rawKey });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockApiKeyRepo.findOne).toHaveBeenCalledWith({
        where: { keyHash, status: 'active' },
      });
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant-2'),
      );
    });

    it('should reject an invalid API key', async () => {
      mockApiKeyRepo.findOne.mockResolvedValue(null);

      const context = createMockContext({ 'x-api-key': 'invalid-key' });
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject an expired API key', async () => {
      const rawKey = 'crm_expired_key_12345';
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      mockApiKeyRepo.findOne.mockResolvedValue({
        id: 'key-2',
        tenantId: 'tenant-3',
        keyHash,
        status: 'active',
        expiresAt: new Date('2020-01-01'),
        createdBy: 'user-3',
      });

      const context = createMockContext({ 'x-api-key': rawKey });
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should prefer API key over bearer token when both are present', async () => {
      const rawKey = 'crm_prefer_apikey_test';
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      mockApiKeyRepo.findOne.mockResolvedValue({
        id: 'key-3',
        tenantId: 'tenant-4',
        keyHash,
        status: 'active',
        expiresAt: null,
        createdBy: 'user-4',
      });

      const context = createMockContext({
        'x-api-key': rawKey,
        authorization: 'Bearer some-jwt',
      });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      // JWT should NOT have been verified since API key takes precedence
      expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
    });
  });

  describe('No authentication', () => {
    it('should reject requests with no authentication headers', async () => {
      const context = createMockContext({});
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });
});
