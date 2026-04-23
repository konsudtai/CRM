import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Contact } from './contact.entity';
import { Note } from './note.entity';
import { Activity } from './activity.entity';
import { AccountTag } from './account-tag.entity';

@Entity('accounts')
@Index(['tenantId'])
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 255, name: 'company_name' })
  companyName!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  industry!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'tax_id' })
  taxId!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  website!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  street!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'sub_district' })
  subDistrict!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  district!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  province!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'postal_code' })
  postalCode!: string | null;

  @Column({ type: 'jsonb', nullable: true, default: {}, name: 'custom_fields' })
  customFields!: Record<string, unknown>;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true, name: 'deleted_at' })
  deletedAt!: Date | null;

  @OneToMany(() => Contact, (contact) => contact.account)
  contacts!: Contact[];

  @OneToMany(() => AccountTag, (accountTag) => accountTag.account)
  accountTags!: AccountTag[];
}
