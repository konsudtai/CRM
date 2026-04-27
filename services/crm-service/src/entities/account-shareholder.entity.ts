import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Account } from './account.entity';

@Entity('account_shareholders')
export class AccountShareholder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'account_id' })
  accountId!: string;

  @Column({ type: 'varchar', length: 255, name: 'full_name' })
  fullName!: string;

  @Column({ type: 'varchar', length: 13, nullable: true, name: 'id_card' })
  idCard!: string | null;

  @Column({ type: 'varchar', length: 100, default: 'Thai' })
  nationality!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'share_percentage' })
  sharePercentage!: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'share_amount' })
  shareAmount!: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  position!: string | null;

  @Column({ type: 'boolean', default: false, name: 'is_authorized' })
  isAuthorized!: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id' })
  account!: Account;
}
