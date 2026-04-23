import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { PipelineStage } from './pipeline-stage.entity';
import { OpportunityHistory } from './opportunity-history.entity';

@Entity('opportunities')
@Index(['tenantId'])
@Index(['tenantId', 'stageId'])
@Index(['tenantId', 'assignedTo'])
export class Opportunity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 255, name: 'deal_name' })
  dealName!: string;

  @Column({ type: 'uuid', name: 'account_id' })
  accountId!: string;

  @Column({ type: 'uuid', nullable: true, name: 'contact_id' })
  contactId!: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'estimated_value' })
  estimatedValue!: number;

  @Column({ type: 'uuid', name: 'stage_id' })
  stageId!: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'weighted_value' })
  weightedValue!: number;

  @Column({ type: 'date', name: 'expected_close_date' })
  expectedCloseDate!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'closed_reason' })
  closedReason!: string | null;

  @Column({ type: 'text', nullable: true, name: 'closed_notes' })
  closedNotes!: string | null;

  @Column({ type: 'uuid', name: 'assigned_to' })
  assignedTo!: string;

  @Column({ type: 'integer', nullable: true, name: 'ai_close_probability' })
  aiCloseProbability!: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => PipelineStage, (stage) => stage.opportunities)
  @JoinColumn({ name: 'stage_id' })
  stage!: PipelineStage;

  @OneToMany(() => OpportunityHistory, (history) => history.opportunity)
  history!: OpportunityHistory[];
}
