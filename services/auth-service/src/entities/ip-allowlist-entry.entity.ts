import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * Stores IP addresses or CIDR ranges that are allowed to access
 * the platform for a given tenant. When a tenant has entries in this
 * table, only requests from matching IPs are permitted.
 */
@Entity('ip_allowlist_entries')
export class IpAllowlistEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 45 })
  address!: string; // IPv4, IPv6, or CIDR notation (e.g. "192.168.1.0/24")

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
