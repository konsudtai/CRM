import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { WebhookDelivery } from './webhook-delivery.entity';

@Entity('webhook_configs')
@Index(['tenantId'])
export class WebhookConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 1024 })
  url!: string;

  @Column({ type: 'varchar', length: 255 })
  secret!: string;

  @Column({ type: 'text', array: true, name: 'event_types' })
  eventTypes!: string[];

  @Column({ type: 'text', array: true, name: 'entity_types' })
  entityTypes!: string[];

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => WebhookDelivery, (delivery) => delivery.webhook)
  deliveries!: WebhookDelivery[];
}
