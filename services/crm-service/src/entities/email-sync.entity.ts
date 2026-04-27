import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('email_syncs')
@Index(['tenantId'])
@Index(['tenantId', 'userId'])
export class EmailSync {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 20 })
  provider!: 'gmail' | 'outlook';

  @Column({ type: 'varchar', length: 50, default: 'disconnected' })
  status!: 'connected' | 'syncing' | 'error' | 'disconnected';

  @Column({ type: 'text', nullable: true, name: 'access_token' })
  accessToken!: string | null;

  @Column({ type: 'text', nullable: true, name: 'refresh_token' })
  refreshToken!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'token_expires_at' })
  tokenExpiresAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_sync_at' })
  lastSyncAt!: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'last_error' })
  lastError!: string | null;

  @Column({ type: 'int', default: 0, name: 'consecutive_failures' })
  consecutiveFailures!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
