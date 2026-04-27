import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Account } from './account.entity';

@Entity('account_documents')
export class AccountDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'account_id' })
  accountId!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 50, name: 'doc_type' })
  docType!: string; // certificate, vat_registration, id_card, contract, other

  @Column({ type: 'varchar', length: 255, name: 'doc_name' })
  docName!: string;

  @Column({ type: 'varchar', length: 1024, name: 'file_url' })
  fileUrl!: string;

  @Column({ type: 'bigint', nullable: true, name: 'file_size' })
  fileSize!: number | null;

  @Column({ type: 'date', nullable: true, name: 'expiry_date' })
  expiryDate!: Date | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  notes!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'uploaded_by' })
  uploadedBy!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id' })
  account!: Account;
}
