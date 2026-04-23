import { LineService } from './line.service';

describe('LineService', () => {
  let service: LineService;
  let mockNotificationRepo: any;

  beforeEach(() => {
    mockNotificationRepo = {
      create: jest.fn((data: any) => ({ id: 'notif-1', ...data })),
      save: jest.fn((entity: any) => Promise.resolve(entity)),
    };

    service = new LineService(mockNotificationRepo);
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff: 1s base', () => {
      expect(service.calculateBackoffDelay(0, 1000)).toBe(1000); // 1s
      expect(service.calculateBackoffDelay(1, 1000)).toBe(2000); // 2s
      expect(service.calculateBackoffDelay(2, 1000)).toBe(4000); // 4s
    });

    it('should handle attempt 0 correctly', () => {
      expect(service.calculateBackoffDelay(0, 500)).toBe(500);
    });
  });

  describe('configureChannel', () => {
    it('should store and retrieve channel config', () => {
      service.configureChannel({
        tenantId: 'tenant-1',
        channelAccessToken: 'token-abc',
        channelSecret: 'secret-xyz',
      });

      const config = service.getConfig('tenant-1');
      expect(config).toBeDefined();
      expect(config!.channelAccessToken).toBe('token-abc');
      expect(config!.channelSecret).toBe('secret-xyz');
    });

    it('should return undefined for unconfigured tenant', () => {
      expect(service.getConfig('nonexistent')).toBeUndefined();
    });
  });

  describe('sendPushMessage', () => {
    it('should return error when channel not configured', async () => {
      const result = await service.sendPushMessage('no-tenant', 'user-1', [
        { type: 'text', text: 'hello' },
      ]);
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(0);
      expect(result.error).toContain('not configured');
    });

    it('should succeed on first attempt when LINE API returns ok', async () => {
      service.configureChannel({
        tenantId: 'tenant-1',
        channelAccessToken: 'token',
        channelSecret: 'secret',
      });

      // Mock global fetch
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{}'),
      });
      global.fetch = mockFetch;

      const result = await service.sendPushMessage('tenant-1', 'user-1', [
        { type: 'text', text: 'hello' },
      ]);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry up to 3 times on failure then report failure', async () => {
      service.configureChannel({
        tenantId: 'tenant-1',
        channelAccessToken: 'token',
        channelSecret: 'secret',
      });

      // Override sleep to be instant
      (service as any).sleep = jest.fn().mockResolvedValue(undefined);

      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });
      global.fetch = mockFetch;

      const result = await service.sendPushMessage('tenant-1', 'user-1', [
        { type: 'text', text: 'hello' },
      ]);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should succeed on retry after initial failures', async () => {
      service.configureChannel({
        tenantId: 'tenant-1',
        channelAccessToken: 'token',
        channelSecret: 'secret',
      });

      (service as any).sleep = jest.fn().mockResolvedValue(undefined);

      let callCount = 0;
      const mockFetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve({
            ok: false,
            status: 500,
            text: () => Promise.resolve('error'),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('{}'),
        });
      });
      global.fetch = mockFetch;

      const result = await service.sendPushMessage('tenant-1', 'user-1', [
        { type: 'text', text: 'hello' },
      ]);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });
  });
});
