import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';
import { of } from 'rxjs';
import { lastValueFrom } from 'rxjs';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let mockAuditService: { log: jest.Mock };

  beforeEach(() => {
    mockAuditService = { log: jest.fn().mockResolvedValue({}) };
    interceptor = new AuditInterceptor(mockAuditService as unknown as AuditService);
  });

  function createMockContext(overrides: {
    method: string;
    path: string;
    params?: Record<string, string>;
    user?: { sub: string; tenantId: string };
    ip?: string;
    headers?: Record<string, string>;
  }) {
    const request = {
      method: overrides.method,
      path: overrides.path,
      params: overrides.params || {},
      user: overrides.user || null,
      ip: overrides.ip || '127.0.0.1',
      headers: overrides.headers || {},
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;
  }

  it('should skip GET requests', async () => {
    const ctx = createMockContext({ method: 'GET', path: '/accounts' });
    const next = { handle: () => of({ id: '1' }) };

    const result = await lastValueFrom(interceptor.intercept(ctx, next));

    expect(result).toEqual({ id: '1' });
    expect(mockAuditService.log).not.toHaveBeenCalled();
  });

  it('should skip requests without authenticated user', async () => {
    const ctx = createMockContext({ method: 'POST', path: '/accounts' });
    const next = { handle: () => of({ id: '1' }) };

    const result = await lastValueFrom(interceptor.intercept(ctx, next));

    expect(result).toEqual({ id: '1' });
    expect(mockAuditService.log).not.toHaveBeenCalled();
  });

  it('should log a create action for POST requests', async () => {
    const ctx = createMockContext({
      method: 'POST',
      path: '/accounts',
      user: { sub: 'user-1', tenantId: 'tenant-1' },
    });
    const responseBody = { id: 'new-account-id', companyName: 'Test' };
    const next = { handle: () => of(responseBody) };

    await lastValueFrom(interceptor.intercept(ctx, next));

    // Allow async audit log call to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        entityType: 'account',
        entityId: 'new-account-id',
        action: 'create',
        newValues: responseBody,
      }),
    );
  });

  it('should log an update action for PUT requests', async () => {
    const ctx = createMockContext({
      method: 'PUT',
      path: '/accounts/abc-123',
      params: { id: 'abc-123' },
      user: { sub: 'user-2', tenantId: 'tenant-2' },
    });
    const responseBody = { id: 'abc-123', companyName: 'Updated' };
    const next = { handle: () => of(responseBody) };

    await lastValueFrom(interceptor.intercept(ctx, next));
    await new Promise((r) => setTimeout(r, 10));

    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityId: 'abc-123',
        entityType: 'account',
      }),
    );
  });

  it('should log a delete action for DELETE requests', async () => {
    const ctx = createMockContext({
      method: 'DELETE',
      path: '/contacts/def-456',
      params: { id: 'def-456' },
      user: { sub: 'user-3', tenantId: 'tenant-3' },
    });
    const next = { handle: () => of({ deleted: true }) };

    await lastValueFrom(interceptor.intercept(ctx, next));
    await new Promise((r) => setTimeout(r, 10));

    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete',
        entityId: 'def-456',
        entityType: 'contact',
        newValues: null,
      }),
    );
  });

  it('should extract IP from x-forwarded-for header', async () => {
    const ctx = createMockContext({
      method: 'POST',
      path: '/accounts',
      user: { sub: 'u1', tenantId: 't1' },
      headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' },
    });
    const next = { handle: () => of({ id: 'x' }) };

    await lastValueFrom(interceptor.intercept(ctx, next));
    await new Promise((r) => setTimeout(r, 10));

    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: '10.0.0.1' }),
    );
  });

  it('should not throw if audit logging fails', async () => {
    mockAuditService.log.mockRejectedValue(new Error('DB down'));
    const ctx = createMockContext({
      method: 'POST',
      path: '/accounts',
      user: { sub: 'u1', tenantId: 't1' },
    });
    const next = { handle: () => of({ id: 'x' }) };

    // Should not throw
    const result = await lastValueFrom(interceptor.intercept(ctx, next));
    expect(result).toEqual({ id: 'x' });
  });
});
