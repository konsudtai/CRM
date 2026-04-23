import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Attachment } from './attachment.entity';

@Entity('notes')
@Index(['tenantId'])
@Index(['tenantId', 'entityType', 'entityId'])
export class Note {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 50, name: 'entity_type' })
  entityType!: string;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'uuid', name: 'author_id' })
  authorId!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => Attachment, (attachment) => attachment.note)
  attachments!: Attachment[];
}
