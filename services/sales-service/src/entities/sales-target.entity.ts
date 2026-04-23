import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

@Entity('sales_targets')
@Index(['tenantId'])
@Index(['tenantId', 'userId', 'period', 'year'])
export class SalesTarget {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 20 })
  period!: 'monthly' | 'quarterly';

  @Column({ type: 'integer' })
  year!: number;

  @Column({ type: 'integer', nullable: true })
  month!: number | null;

  @Column({ type: 'integer', nullable: true })
  quarter!: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'target_amount' })
  targetAmount!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'achieved_amount' })
  achievedAmount!: number;
}
