import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WebhookConfig } from './webhook-config.entity';

@Entity('webhook_deliveries')
@Index(['webhookId'])
@Index(['status'])
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'webhook_id' })
  webhookId!: string;

  @Column({ type: 'varchar', length: 100, name: 'event_type' })
  eventType!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'int', nullable: true, name: 'response_status' })
  responseStatus!: number | null;

  @Column({ type: 'text', nullable: true, name: 'response_body' })
  responseBody!: string | null;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: string;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'next_retry_at' })
  nextRetryAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => WebhookConfig, (config) => config.deliveries)
  @JoinColumn({ name: 'webhook_id' })
  webhook!: WebhookConfig;
}
