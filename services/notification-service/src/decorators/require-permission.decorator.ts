import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'required_permission';

export interface RequiredPermission {
  module: string;
  action: 'create' | 'read' | 'update' | 'delete';
}

/**
 * Decorator that marks an endpoint as requiring a specific permission.
 * Used in conjunction with PermissionGuard.
 *
 * @example
 * @RequirePermission('notifications', 'create')
 * @UseGuards(TenantGuard, PermissionGuard)
 * async sendNotification() { ... }
 */
export const RequirePermission = (
  module: string,
  action: 'create' | 'read' | 'update' | 'delete',
) => SetMetadata(PERMISSION_KEY, { module, action } as RequiredPermission);
