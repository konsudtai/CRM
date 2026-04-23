import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Opportunity } from './opportunity.entity';

@Entity('opportunity_history')
@Index(['opportunityId'])
export class OpportunityHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'opportunity_id' })
  opportunityId!: string;

  @Column({ type: 'varchar', length: 255, name: 'field_name' })
  fieldName!: string;

  @Column({ type: 'text', nullable: true, name: 'old_value' })
  oldValue!: string | null;

  @Column({ type: 'text', nullable: true, name: 'new_value' })
  newValue!: string | null;

  @Column({ type: 'uuid', name: 'changed_by' })
  changedBy!: string;

  @Column({ type: 'timestamptz', name: 'changed_at', default: () => 'NOW()' })
  changedAt!: Date;

  @ManyToOne(() => Opportunity, (opp) => opp.history)
  @JoinColumn({ name: 'opportunity_id' })
  opportunity!: Opportunity;
}
