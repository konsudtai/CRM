import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { QuotationLineItem } from './quotation-line-item.entity';

@Entity('quotations')
@Index(['tenantId'])
export class Quotation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 50, name: 'quotation_number' })
  quotationNumber!: string;

  @Column({ type: 'uuid', name: 'account_id' })
  accountId!: string;

  @Column({ type: 'uuid', nullable: true, name: 'contact_id' })
  contactId!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'opportunity_id' })
  opportunityId!: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'total_discount' })
  totalDiscount!: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'vat_amount' })
  vatAmount!: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'wht_amount' })
  whtAmount!: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'grand_total' })
  grandTotal!: number;

  @Column({ type: 'varchar', length: 30, default: 'draft' })
  status!: string;

  @Column({ type: 'varchar', length: 1024, nullable: true, name: 'pdf_url' })
  pdfUrl!: string | null;

  @Column({ type: 'date', nullable: true, name: 'valid_until' })
  validUntil!: Date | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @Column({ type: 'uuid', nullable: true, name: 'approved_by' })
  approvedBy!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => QuotationLineItem, (lineItem) => lineItem.quotation)
  lineItems!: QuotationLineItem[];
}
