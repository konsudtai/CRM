import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Activity } from '../../entities/activity.entity';
import { Task } from '../../entities/task.entity';
import { LogCallDto } from './dto/log-call.dto';

export interface CalendarEntry {
  id: string;
  type: 'task' | 'call' | 'meeting';
  title: string;
  date: string; // YYYY-MM-DD
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface CalendarResponse {
  view: 'day' | 'week' | 'month';
  start: string;
  end: string;
  entries: Record<string, CalendarEntry[]>; // grouped by date
}

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  async logCall(
    tenantId: string,
    userId: string,
    dto: LogCallDto,
  ): Promise<Activity> {
    const entityId = dto.accountId || dto.contactId;
    if (!entityId) {
      throw new BadRequestException(
        'Either accountId or contactId must be provided',
      );
    }

    const activity = this.activityRepo.create({
      tenantId,
      entityType: 'call',
      entityId,
      summary: `Call - ${dto.outcome} (${dto.duration} min)`,
      userId,
      timestamp: new Date(),
      metadata: {
        duration: dto.duration,
        outcome: dto.outcome,
        notes: dto.notes ?? null,
        accountId: dto.accountId ?? null,
        contactId: dto.contactId ?? null,
      },
    });

    return this.activityRepo.save(activity);
  }

  async getCalendarView(
    tenantId: string,
    start: string,
    end: string,
    view: 'day' | 'week' | 'month',
  ): Promise<CalendarResponse> {
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid start or end date');
    }

    // Fetch activities (calls, meetings) within range
    const activities = await this.activityRepo.find({
      where: {
        tenantId,
        timestamp: Between(startDate, endDate),
      },
      order: { timestamp: 'ASC' },
    });

    // Fetch tasks with due dates in range
    const tasks = await this.taskRepo.find({
      where: {
        tenantId,
        dueDate: Between(start.split('T')[0], end.split('T')[0]),
      },
      order: { dueDate: 'ASC' },
    });

    const entries: Record<string, CalendarEntry[]> = {};

    // Add activities
    for (const activity of activities) {
      const dateKey = activity.timestamp.toISOString().split('T')[0];
      if (!entries[dateKey]) entries[dateKey] = [];
      entries[dateKey].push({
        id: activity.id,
        type: activity.entityType as 'call' | 'meeting',
        title: activity.summary,
        date: dateKey,
        timestamp: activity.timestamp,
        metadata: activity.metadata,
      });
    }

    // Add tasks
    for (const task of tasks) {
      const dateKey = task.dueDate;
      if (!entries[dateKey]) entries[dateKey] = [];
      entries[dateKey].push({
        id: task.id,
        type: 'task',
        title: task.title,
        date: dateKey,
        timestamp: task.createdAt,
        metadata: {
          priority: task.priority,
          status: task.status,
          assignedTo: task.assignedTo,
        },
      });
    }

    return { view, start, end, entries };
  }
}
