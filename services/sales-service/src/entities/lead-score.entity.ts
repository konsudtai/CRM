import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Lead } from './lead.entity';

@Entity('lead_scores')
@Index(['leadId'])
export class LeadScore {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'lead_id' })
  leadId!: string;

  @Column({ type: 'integer' })
  score!: number;

  @Column({ type: 'jsonb', nullable: true, default: [] })
  factors!: Record<string, unknown>[];

  @Column({ type: 'timestamptz', name: 'calculated_at', default: () => 'NOW()' })
  calculatedAt!: Date;

  @ManyToOne(() => Lead, (lead) => lead.scores)
  @JoinColumn({ name: 'lead_id' })
  lead!: Lead;
}
