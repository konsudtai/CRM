import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { AuditService } from './audit.service';

/**
 * NestJS interceptor that automatically creates audit log entries
 * for CRM entity mutations (POST, PUT, DELETE).
 *
 * Extracts user info from the request (set by TenantGuard),
 * derives entity_type from the route path, and captures
 * the response body as new_values for create/update operations.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;

    // Only audit mutating operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const user = (request as any).user;
    if (!user?.tenantId || !user?.sub) {
      return next.handle();
    }

    const action = this.mapMethodToAction(method);
    const entityType = this.deriveEntityType(request.path);
    const entityIdFromParams = request.params?.id;
    const ipAddress =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.ip ||
      null;

    return next.handle().pipe(
      tap((responseBody) => {
        const entityId =
          entityIdFromParams ||
          responseBody?.id ||
          null;

        if (!entityId || !entityType) return;

        const newValues =
          action === 'delete' ? null : (responseBody ?? null);
        const oldValues = null; // old_values require pre-fetch; kept null for interceptor approach

        this.auditService
          .log({
            tenantId: user.tenantId,
            userId: user.sub,
            entityType,
            entityId,
            action,
            oldValues,
            newValues,
            ipAddress,
          })
          .catch(() => {
            // Audit logging should never break the main request flow
          });
      }),
    );
  }

  private mapMethodToAction(
    method: string,
  ): 'create' | 'update' | 'delete' {
    switch (method) {
      case 'POST':
        return 'create';
      case 'DELETE':
        return 'delete';
      default:
        return 'update';
    }
  }

  /**
   * Derive entity type from the request path.
   * e.g. /accounts/123 → "account", /contacts → "contact"
   */
  private deriveEntityType(path: string): string | null {
    const segments = path.split('/').filter(Boolean);
    // Find the first non-UUID segment as the resource name
    const resource = segments.find(
      (s) =>
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          s,
        ),
    );
    if (!resource) return null;
    // Singularize simple plural (accounts → account)
    return resource.endsWith('s') ? resource.slice(0, -1) : resource;
  }
}
