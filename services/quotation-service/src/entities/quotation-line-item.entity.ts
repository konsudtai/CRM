import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Quotation } from './quotation.entity';

@Entity('quotation_line_items')
@Index(['quotationId'])
export class QuotationLineItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'quotation_id' })
  quotationId!: string;

  @Column({ type: 'uuid', name: 'product_id' })
  productId!: string;

  @Column({ type: 'varchar', length: 255, name: 'product_name' })
  productName!: string;

  @Column({ type: 'varchar', length: 100 })
  sku!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'unit_price' })
  unitPrice!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discount!: number;

  @Column({ type: 'varchar', length: 20, default: 'fixed', name: 'discount_type' })
  discountType!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'wht_rate' })
  whtRate!: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'line_total' })
  lineTotal!: number;

  @ManyToOne(() => Quotation, (quotation) => quotation.lineItems)
  @JoinColumn({ name: 'quotation_id' })
  quotation!: Quotation;
}
