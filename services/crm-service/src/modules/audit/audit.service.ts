import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Create an immutable audit log entry. This is the only write operation
   * allowed — no update or delete methods exist by design.
   */
  async log(params: {
    tenantId: string;
    userId: string;
    entityType: string;
    entityId: string;
    action: 'create' | 'update' | 'delete';
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
    ipAddress?: string | null;
  }): Promise<AuditLog> {
    const entry = this.auditLogRepository.create({
      tenantId: params.tenantId,
      userId: params.userId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      oldValues: params.oldValues ?? null,
      newValues: params.newValues ?? null,
      ipAddress: params.ipAddress ?? null,
    });
    return this.auditLogRepository.save(entry);
  }

  /**
   * Read-only query for audit logs by entity.
   */
  async findByEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { tenantId, entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }
}
