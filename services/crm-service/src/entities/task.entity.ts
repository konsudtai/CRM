import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type TaskPriority = 'High' | 'Medium' | 'Low';
export type TaskStatus = 'Open' | 'In Progress' | 'Completed' | 'Overdue';

@Entity('tasks')
@Index(['tenantId'])
@Index(['tenantId', 'dueDate'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'assignedTo'])
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'date', name: 'due_date' })
  dueDate!: string;

  @Column({ type: 'varchar', length: 20 })
  priority!: TaskPriority;

  @Column({ type: 'varchar', length: 20, default: 'Open' })
  status!: TaskStatus;

  @Column({ type: 'uuid', nullable: true, name: 'assigned_to' })
  assignedTo!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'account_id' })
  accountId!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'contact_id' })
  contactId!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'opportunity_id' })
  opportunityId!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
