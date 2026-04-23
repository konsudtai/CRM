/**
 * Authentication and RBAC interfaces.
 */

export interface AuthTokenPayload {
  sub: string; // user_id
  tenantId: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
}

export interface Permission {
  module: string; // e.g., "leads", "opportunities", "quotations"
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  isDefault: boolean;
  permissions: Permission[];
}
