import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { Role } from './role.entity';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug!: string;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  settings!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 512, nullable: true, name: 'line_channel_token' })
  lineChannelToken!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true, name: 'line_channel_secret' })
  lineChannelSecret!: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => User, (user) => user.tenant)
  users!: User[];

  @OneToMany(() => Role, (role) => role.tenant)
  roles!: Role[];
}
