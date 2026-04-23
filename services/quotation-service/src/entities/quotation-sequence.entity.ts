import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
} from 'typeorm';

@Entity('quotation_sequences')
@Unique(['tenantId', 'prefix', 'year'])
@Index(['tenantId'])
export class QuotationSequence {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 20 })
  prefix!: string;

  @Column({ type: 'integer', name: 'current_value', default: 0 })
  currentValue!: number;

  @Column({ type: 'integer' })
  year!: number;
}
