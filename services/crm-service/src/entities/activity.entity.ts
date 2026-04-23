import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

@Entity('activities')
@Index(['tenantId'])
@Index(['tenantId', 'entityId'])
@Index(['tenantId', 'timestamp'])
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 50, name: 'entity_type' })
  entityType!: 'call' | 'email' | 'meeting' | 'note' | 'deal_change' | 'task';

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId!: string;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'timestamptz' })
  timestamp!: Date;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata!: Record<string, unknown>;
}
