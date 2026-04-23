import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Account } from './account.entity';

@Entity('contacts')
@Index(['tenantId'])
@Index(['tenantId', 'accountId'])
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'account_id' })
  accountId!: string;

  @Column({ type: 'varchar', length: 255, name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar', length: 255, name: 'last_name' })
  lastName!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'line_id' })
  lineId!: string | null;

  @Column({ type: 'jsonb', nullable: true, default: {}, name: 'custom_fields' })
  customFields!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Account, (account) => account.contacts)
  @JoinColumn({ name: 'account_id' })
  account!: Account;
}
