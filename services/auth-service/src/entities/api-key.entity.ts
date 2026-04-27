import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';

@Entity('api_keys')
@Index(['tenantId'])
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 64, unique: true, name: 'key_hash' })
  keyHash!: string;

  @Column({ type: 'varchar', length: 8, name: 'key_prefix' })
  keyPrefix!: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status!: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'expires_at' })
  expiresAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_used_at' })
  lastUsedAt!: Date | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;
}
