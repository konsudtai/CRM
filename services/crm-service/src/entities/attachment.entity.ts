import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Note } from './note.entity';

@Entity('attachments')
@Index(['tenantId'])
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'note_id' })
  noteId!: string;

  @Column({ type: 'varchar', length: 512, name: 'file_name' })
  fileName!: string;

  @Column({ type: 'varchar', length: 1024, name: 'file_url' })
  fileUrl!: string;

  @Column({ type: 'bigint', name: 'file_size' })
  fileSize!: number;

  @Column({ type: 'varchar', length: 255, name: 'mime_type' })
  mimeType!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Note, (note) => note.attachments)
  @JoinColumn({ name: 'note_id' })
  note!: Note;
}
