import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, DeleteDateColumn, OneToMany, ManyToOne, JoinColumn,
} from 'typeorm';
import { Contact } from './contact.entity';
import { AccountTag } from './account-tag.entity';

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  // === Company Info ===
  @Column({ type: 'varchar', length: 255, name: 'company_name' })
  companyName!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'company_name_en' })
  companyNameEn!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'company_type' })
  companyType!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  industry!: string | null;

  @Column({ type: 'text', nullable: true, name: 'business_desc' })
  businessDesc!: string | null;

  // === Tax & Registration ===
  @Column({ type: 'varchar', length: 13, nullable: true, name: 'tax_id' })
  taxId!: string | null;

  @Column({ type: 'varchar', length: 10, default: '00000', name: 'branch_code' })
  branchCode!: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'branch_name' })
  branchName!: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'registered_capital' })
  registeredCapital!: number | null;

  @Column({ type: 'date', nullable: true, name: 'registration_date' })
  registrationDate!: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'registration_no' })
  registrationNo!: string | null;

  // === Contact Info ===
  @Column({ type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone2!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  fax!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  website!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'line_oa_id' })
  lineOaId!: string | null;

  // === Address ===
  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'sub_district' })
  subDistrict!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  district!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  province!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'postal_code' })
  postalCode!: string | null;

  @Column({ type: 'varchar', length: 100, default: 'Thailand' })
  country!: string;

  // === Shipping Address ===
  @Column({ type: 'text', nullable: true, name: 'shipping_address' })
  shippingAddress!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'shipping_sub_district' })
  shippingSubDistrict!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'shipping_district' })
  shippingDistrict!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'shipping_province' })
  shippingProvince!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'shipping_postal_code' })
  shippingPostalCode!: string | null;

  // === Sales Info ===
  @Column({ type: 'uuid', nullable: true, name: 'account_owner' })
  accountOwner!: string | null;

  @Column({ type: 'varchar', length: 30, default: 'active', name: 'account_status' })
  accountStatus!: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'account_source' })
  accountSource!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'standard', name: 'account_tier' })
  accountTier!: string;

  @Column({ type: 'integer', default: 30, name: 'credit_term' })
  creditTerm!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'credit_limit' })
  creditLimit!: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'payment_method' })
  paymentMethod!: string | null;

  // === Financial Summary ===
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'total_revenue' })
  totalRevenue!: number;

  @Column({ type: 'integer', default: 0, name: 'total_deals' })
  totalDeals!: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_activity_at' })
  lastActivityAt!: Date | null;

  // === Notes ===
  @Column({ type: 'text', nullable: true, name: 'internal_notes' })
  internalNotes!: string | null;

  @Column({ type: 'jsonb', nullable: true, default: {}, name: 'custom_fields' })
  customFields!: Record<string, unknown>;

  // === Metadata ===
  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true, name: 'deleted_at' })
  deletedAt!: Date | null;

  // === Relations ===
  @OneToMany(() => Contact, (contact) => contact.account)
  contacts!: Contact[];

  @OneToMany(() => AccountTag, (accountTag) => accountTag.account)
  accountTags!: AccountTag[];
}
