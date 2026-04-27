import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { UserRole } from './user-role.entity';

@Entity('users')
@Index(['tenantId', 'email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true, name: 'cognito_sub' })
  cognitoSub!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'password_hash' })
  passwordHash!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar', length: 255, name: 'last_name' })
  lastName!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'line_id' })
  lineId!: string | null;

  @Column({ type: 'boolean', default: false, name: 'mfa_enabled' })
  mfaEnabled!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'mfa_secret' })
  mfaSecret!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'sso_provider' })
  ssoProvider!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'sso_subject' })
  ssoSubject!: string | null;

  @Column({ type: 'varchar', length: 10, default: 'th', name: 'preferred_language' })
  preferredLanguage!: string;

  @Column({ type: 'varchar', length: 20, default: 'buddhist', name: 'preferred_calendar' })
  preferredCalendar!: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_login_at' })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.users)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles!: UserRole[];
}
