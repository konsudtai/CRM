import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Immutable, append-only audit log entity.
 * Records are NEVER updated or deleted.
 */
@Entity('audit_logs')
@Index(['tenantId'])
@Index(['tenantId', 'entityType', 'entityId'])
@Index(['tenantId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 100, name: 'entity_type' })
  entityType!: string;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId!: string;

  @Column({ type: 'varchar', length: 20 })
  action!: 'create' | 'update' | 'delete';

  @Column({ type: 'jsonb', nullable: true, name: 'old_values' })
  oldValues!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'new_values' })
  newValues!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 45, nullable: true, name: 'ip_address' })
  ipAddress!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
