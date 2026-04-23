import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  OneToMany,
} from 'typeorm';
import { Opportunity } from './opportunity.entity';

@Entity('pipeline_stages')
@Index(['tenantId'])
@Index(['tenantId', 'sortOrder'])
export class PipelineStage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'integer', name: 'sort_order' })
  sortOrder!: number;

  @Column({ type: 'integer', default: 0 })
  probability!: number;

  @Column({ type: 'varchar', length: 20, default: '#0071e3' })
  color!: string;

  @OneToMany(() => Opportunity, (opp) => opp.stage)
  opportunities!: Opportunity[];
}
