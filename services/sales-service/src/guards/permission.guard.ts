import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  PERMISSION_KEY,
  RequiredPermission,
} from '../decorators/require-permission.decorator';

/**
 * PermissionGuard checks the user's permissions (from JWT payload)
 * against the required permission set via @RequirePermission decorator.
 *
 * Must be used AFTER TenantGuard (which attaches user to request).
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredPermission>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permission is required on this endpoint, allow access
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;

    if (!user) {
      this.logger.warn('PermissionGuard: No user on request');
      throw new ForbiddenException('Access denied');
    }

    const requiredString = `${required.module}:${required.action}`;
    const userPermissions: string[] = user.permissions || [];

    if (!userPermissions.includes(requiredString)) {
      this.logger.warn(
        `Access denied: user=${user.sub} tenant=${user.tenantId} ` +
          `required=${requiredString} had=[${userPermissions.join(', ')}]`,
      );
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    return true;
  }
}
