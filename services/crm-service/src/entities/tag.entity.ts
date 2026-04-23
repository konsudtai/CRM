import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
} from 'typeorm';
import { AccountTag } from './account-tag.entity';

@Entity('tags')
@Index(['tenantId'])
@Index(['tenantId', 'name'], { unique: true })
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  color!: string | null;

  @OneToMany(() => AccountTag, (accountTag) => accountTag.tag)
  accountTags!: AccountTag[];
}
