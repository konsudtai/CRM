import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Immutable consent record entity for PDPA compliance.
 * Records are NEVER updated or deleted — consent withdrawal
 * creates a new record rather than modifying the original.
 */
@Entity('consent_records')
@Index(['tenantId'])
@Index(['tenantId', 'contactId'])
@Index(['tenantId', 'contactId', 'purpose'])
export class ConsentRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'contact_id' })
  contactId!: string;

  @Column({ type: 'varchar', length: 255 })
  purpose!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: 'granted' | 'withdrawn';

  @Column({ type: 'date', nullable: true, name: 'granted_at' })
  grantedAt!: Date | null;

  @Column({ type: 'date', nullable: true, name: 'expires_at' })
  expiresAt!: Date | null;

  @Column({ type: 'date', nullable: true, name: 'withdrawn_at' })
  withdrawnAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
