import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not, In } from 'typeorm';
import { Task, TaskPriority } from '../../entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

/** Numeric ordering for priority-based sorting: High=1, Medium=2, Low=3 */
const PRIORITY_ORDER: Record<TaskPriority, number> = {
  High: 1,
  Medium: 2,
  Low: 3,
};

export type SortableField = 'due_date' | 'priority' | 'status';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  async create(tenantId: string, dto: CreateTaskDto): Promise<Task> {
    const task = this.taskRepo.create({
      tenantId,
      title: dto.title,
      description: dto.description ?? null,
      dueDate: dto.dueDate,
      priority: dto.priority,
      status: 'Open',
      assignedTo: dto.assignedTo ?? null,
      accountId: dto.accountId ?? null,
      contactId: dto.contactId ?? null,
      opportunityId: dto.opportunityId ?? null,
      completedAt: null,
    });
    return this.taskRepo.save(task);
  }

  async findAll(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      sortBy?: SortableField;
      sortOrder?: 'ASC' | 'DESC';
      status?: string;
      assignedTo?: string;
    } = {},
  ): Promise<{ data: Task[]; total: number; page: number; limit: number }> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const sortOrder = options.sortOrder ?? 'ASC';

    const where: any = { tenantId };
    if (options.status) where.status = options.status;
    if (options.assignedTo) where.assignedTo = options.assignedTo;

    // For priority sorting we need to sort in-memory because of custom ordering
    if (options.sortBy === 'priority') {
      const [allData, total] = await this.taskRepo.findAndCount({ where });
      allData.sort((a, b) => {
        const diff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        return sortOrder === 'ASC' ? diff : -diff;
      });
      const data = allData.slice((page - 1) * limit, page * limit);
      return { data, total, page, limit };
    }

    // Map sortBy to actual column names
    const orderColumn = options.sortBy === 'due_date' ? 'dueDate'
      : options.sortBy === 'status' ? 'status'
      : 'dueDate'; // default sort

    const [data, total] = await this.taskRepo.findAndCount({
      where,
      order: { [orderColumn]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id, tenantId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async update(tenantId: string, id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id, tenantId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.dueDate !== undefined) task.dueDate = dto.dueDate;
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.assignedTo !== undefined) task.assignedTo = dto.assignedTo;
    if (dto.accountId !== undefined) task.accountId = dto.accountId;
    if (dto.contactId !== undefined) task.contactId = dto.contactId;
    if (dto.opportunityId !== undefined) task.opportunityId = dto.opportunityId;

    // Set completedAt when status changes to Completed
    if (dto.status !== undefined) {
      task.status = dto.status;
      if (dto.status === 'Completed' && !task.completedAt) {
        task.completedAt = new Date();
      }
      // Clear completedAt if moving away from Completed
      if (dto.status !== 'Completed') {
        task.completedAt = null;
      }
    }

    return this.taskRepo.save(task);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const task = await this.taskRepo.findOne({
      where: { id, tenantId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.taskRepo.remove(task);
  }

  /**
   * Marks all tasks as Overdue where due_date < current_date
   * and status is not Completed or already Overdue.
   * Designed to be called by a scheduled job (cron).
   */
  async markOverdueTasks(tenantId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const overdueTasks = await this.taskRepo.find({
      where: {
        tenantId,
        dueDate: LessThan(today),
        status: Not(In(['Completed', 'Overdue'])),
      },
    });

    for (const task of overdueTasks) {
      task.status = 'Overdue';
    }

    if (overdueTasks.length > 0) {
      await this.taskRepo.save(overdueTasks);
    }

    return overdueTasks.length;
  }
}
