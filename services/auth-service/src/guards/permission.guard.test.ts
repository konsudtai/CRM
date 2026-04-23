import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';

function createMockContext(user: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionGuard(reflector);
  });

  it('should allow access when no permission is required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = createMockContext({ sub: 'user-1', permissions: [] });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow access when user has the required permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      module: 'leads',
      action: 'create',
    });
    const ctx = createMockContext({
      sub: 'user-1',
      tenantId: 'tenant-1',
      permissions: ['leads:create', 'leads:read'],
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when user lacks the required permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      module: 'leads',
      action: 'delete',
    });
    const ctx = createMockContext({
      sub: 'user-1',
      tenantId: 'tenant-1',
      permissions: ['leads:read'],
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when no user on request', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      module: 'leads',
      action: 'read',
    });
    const ctx = createMockContext(undefined);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should handle user with empty permissions array', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      module: 'users',
      action: 'create',
    });
    const ctx = createMockContext({
      sub: 'user-1',
      tenantId: 'tenant-1',
      permissions: [],
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
