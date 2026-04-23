import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { LeadScore } from './lead-score.entity';

@Entity('leads')
@Index(['tenantId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'assignedTo'])
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'company_name' })
  companyName!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'line_id' })
  lineId!: string | null;

  @Column({ type: 'varchar', length: 100 })
  source!: string;

  @Column({ type: 'varchar', length: 50, default: 'New' })
  status!: string;

  @Column({ type: 'uuid', nullable: true, name: 'assigned_to' })
  assignedTo!: string | null;

  @Column({ type: 'integer', nullable: true, name: 'ai_score' })
  aiScore!: number | null;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => LeadScore, (score) => score.lead)
  scores!: LeadScore[];
}
