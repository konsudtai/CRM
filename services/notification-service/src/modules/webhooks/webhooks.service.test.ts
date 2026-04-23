import * as crypto from 'crypto';
import { WebhooksService } from './webhooks.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let mockConfigRepo: any;
  let mockDeliveryRepo: any;

  beforeEach(() => {
    mockConfigRepo = {
      create: jest.fn((data: any) => ({ id: 'wh-1', ...data })),
      save: jest.fn((entity: any) => Promise.resolve(entity)),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    mockDeliveryRepo = {
      create: jest.fn((data: any) => ({ id: 'del-1', ...data })),
      save: jest.fn((entity: any) => Promise.resolve(entity)),
      find: jest.fn().mockResolvedValue([]),
    };

    service = new WebhooksService(mockConfigRepo, mockDeliveryRepo);
  });

  describe('signPayload', () => {
    it('should produce a valid HMAC-SHA256 signature', () => {
      const payload = '{"event":"test"}';
      const secret = 'my-secret';
      const signature = service.signPayload(payload, secret);

      // Verify against Node crypto directly
      const expected = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      expect(signature).toBe(expected);
    });

    it('should produce different signatures for different secrets', () => {
      const payload = '{"event":"test"}';
      const sig1 = service.signPayload(payload, 'secret-1');
      const sig2 = service.signPayload(payload, 'secret-2');
      expect(sig1).not.toBe(sig2);
    });

    it('should produce different signatures for different payloads', () => {
      const secret = 'my-secret';
      const sig1 = service.signPayload('{"a":1}', secret);
      const sig2 = service.signPayload('{"b":2}', secret);
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('matchesFilter', () => {
    it('should match all when filter array is empty', () => {
      expect(service.matchesFilter([], 'anything')).toBe(true);
    });

    it('should match when value is in filter array', () => {
      expect(service.matchesFilter(['lead', 'opportunity'], 'lead')).toBe(true);
    });

    it('should not match when value is not in filter array', () => {
      expect(service.matchesFilter(['lead', 'opportunity'], 'contact')).toBe(false);
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff: 5s base', () => {
      expect(service.calculateBackoffDelay(0, 5000)).toBe(5000);   // 5s
      expect(service.calculateBackoffDelay(1, 5000)).toBe(10000);  // 10s
      expect(service.calculateBackoffDelay(2, 5000)).toBe(20000);  // 20s
      expect(service.calculateBackoffDelay(3, 5000)).toBe(40000);  // 40s
      expect(service.calculateBackoffDelay(4, 5000)).toBe(80000);  // 80s
    });
  });

  describe('fireEvent', () => {
    it('should only deliver to webhooks matching both entityType and eventType', async () => {
      const matchingConfig = {
        id: 'wh-1',
        tenantId: 'tenant-1',
        url: 'https://example.com/hook',
        secret: 'secret',
        eventTypes: ['created', 'updated'],
        entityTypes: ['lead', 'opportunity'],
        isActive: true,
      };
      const nonMatchingConfig = {
        id: 'wh-2',
        tenantId: 'tenant-1',
        url: 'https://other.com/hook',
        secret: 'secret2',
        eventTypes: ['deleted'],
        entityTypes: ['contact'],
        isActive: true,
      };

      mockConfigRepo.find.mockResolvedValue([matchingConfig, nonMatchingConfig]);

      // Mock deliverWithRetry to track calls
      const deliverSpy = jest
        .spyOn(service, 'deliverWithRetry')
        .mockResolvedValue({} as any);

      await service.fireEvent('tenant-1', 'lead', 'created', { id: '123' });

      // Wait for async fire-and-forget
      await new Promise((r) => setTimeout(r, 50));

      expect(deliverSpy).toHaveBeenCalledTimes(1);
      expect(deliverSpy).toHaveBeenCalledWith(
        matchingConfig,
        'created',
        { id: '123' },
      );
    });

    it('should not deliver when no configs match', async () => {
      mockConfigRepo.find.mockResolvedValue([
        {
          id: 'wh-1',
          tenantId: 'tenant-1',
          eventTypes: ['deleted'],
          entityTypes: ['contact'],
          isActive: true,
        },
      ]);

      const deliverSpy = jest
        .spyOn(service, 'deliverWithRetry')
        .mockResolvedValue({} as any);

      await service.fireEvent('tenant-1', 'lead', 'created', { id: '123' });
      await new Promise((r) => setTimeout(r, 50));

      expect(deliverSpy).not.toHaveBeenCalled();
    });

    it('should deliver to configs with empty filter arrays (match all)', async () => {
      const wildcardConfig = {
        id: 'wh-1',
        tenantId: 'tenant-1',
        url: 'https://example.com/hook',
        secret: 'secret',
        eventTypes: [],
        entityTypes: [],
        isActive: true,
      };

      mockConfigRepo.find.mockResolvedValue([wildcardConfig]);

      const deliverSpy = jest
        .spyOn(service, 'deliverWithRetry')
        .mockResolvedValue({} as any);

      await service.fireEvent('tenant-1', 'lead', 'created', { id: '123' });
      await new Promise((r) => setTimeout(r, 50));

      expect(deliverSpy).toHaveBeenCalledTimes(1);
    });
  });
});
