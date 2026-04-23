import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Task } from '../../entities/task.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '00000000-0000-0000-0000-000000000010',
    tenantId: TENANT_ID,
    title: 'Follow up with client',
    description: 'Call about proposal',
    dueDate: '2025-03-15',
    priority: 'High',
    status: 'Open',
    assignedTo: '00000000-0000-0000-0000-000000000099',
    accountId: null,
    contactId: null,
    opportunityId: null,
    completedAt: null,
    createdAt: new Date('2025-01-01'),
    ...overrides,
  } as Task;
}

describe('TasksService', () => {
  let service: TasksService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) => {
        if (Array.isArray(entity)) {
          return Promise.resolve(entity.map((e) => ({ ...makeTask(), ...e })));
        }
        return Promise.resolve({ ...makeTask(), ...entity });
      }),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      find: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task), useValue: repo },
      ],
    }).compile();

    service = module.get(TasksService);
  });

  describe('create', () => {
    it('should create a task with required fields', async () => {
      const dto = {
        title: 'New task',
        dueDate: '2025-06-01',
        priority: 'High' as const,
      };

      const result = await service.create(TENANT_ID, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          title: 'New task',
          dueDate: '2025-06-01',
          priority: 'High',
          status: 'Open',
          completedAt: null,
        }),
      );
      expect(repo.save).toHaveBeenCalled();
      expect(result.title).toBe('New task');
    });

    it('should default optional fields to null', async () => {
      const dto = {
        title: 'Minimal task',
        dueDate: '2025-06-01',
        priority: 'Low' as const,
      };

      await service.create(TENANT_ID, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
          assignedTo: null,
          accountId: null,
          contactId: null,
          opportunityId: null,
        }),
      );
    });

    it('should accept optional association fields', async () => {
      const dto = {
        title: 'Linked task',
        dueDate: '2025-06-01',
        priority: 'Medium' as const,
        accountId: '00000000-0000-0000-0000-000000000020',
        contactId: '00000000-0000-0000-0000-000000000030',
      };

      await service.create(TENANT_ID, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: '00000000-0000-0000-0000-000000000020',
          contactId: '00000000-0000-0000-0000-000000000030',
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated tasks with defaults', async () => {
      const tasks = [makeTask()];
      repo.findAndCount.mockResolvedValue([tasks, 1]);

      const result = await service.findAll(TENANT_ID);

      expect(result).toEqual({ data: tasks, total: 1, page: 1, limit: 20 });
    });

    it('should filter by status', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(TENANT_ID, { status: 'Open' });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, status: 'Open' },
        }),
      );
    });

    it('should filter by assignedTo', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      const assignedTo = '00000000-0000-0000-0000-000000000099';

      await service.findAll(TENANT_ID, { assignedTo });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, assignedTo },
        }),
      );
    });

    it('should sort by priority in-memory (High=1, Medium=2, Low=3)', async () => {
      const tasks = [
        makeTask({ id: 'a', priority: 'Low' }),
        makeTask({ id: 'b', priority: 'High' }),
        makeTask({ id: 'c', priority: 'Medium' }),
      ];
      repo.findAndCount.mockResolvedValue([tasks, 3]);

      const result = await service.findAll(TENANT_ID, { sortBy: 'priority', sortOrder: 'ASC' });

      expect(result.data[0].priority).toBe('High');
      expect(result.data[1].priority).toBe('Medium');
      expect(result.data[2].priority).toBe('Low');
    });

    it('should sort by priority DESC', async () => {
      const tasks = [
        makeTask({ id: 'a', priority: 'Low' }),
        makeTask({ id: 'b', priority: 'High' }),
        makeTask({ id: 'c', priority: 'Medium' }),
      ];
      repo.findAndCount.mockResolvedValue([tasks, 3]);

      const result = await service.findAll(TENANT_ID, { sortBy: 'priority', sortOrder: 'DESC' });

      expect(result.data[0].priority).toBe('Low');
      expect(result.data[1].priority).toBe('Medium');
      expect(result.data[2].priority).toBe('High');
    });

    it('should paginate correctly', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(TENANT_ID, { page: 3, limit: 5 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a task by id and tenant', async () => {
      const task = makeTask();
      repo.findOne.mockResolvedValue(task);

      const result = await service.findOne(TENANT_ID, task.id);

      expect(result).toEqual(task);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: task.id, tenantId: TENANT_ID },
      });
    });

    it('should throw NotFoundException when task not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne(TENANT_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update provided fields', async () => {
      const existing = makeTask();
      repo.findOne.mockResolvedValue({ ...existing });

      await service.update(TENANT_ID, existing.id, {
        title: 'Updated title',
        priority: 'Low',
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated title',
          priority: 'Low',
        }),
      );
    });

    it('should set completedAt when status changes to Completed', async () => {
      const existing = makeTask({ status: 'Open', completedAt: null });
      repo.findOne.mockResolvedValue({ ...existing });

      const result = await service.update(TENANT_ID, existing.id, {
        status: 'Completed',
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Completed',
          completedAt: expect.any(Date),
        }),
      );
    });

    it('should clear completedAt when status changes away from Completed', async () => {
      const existing = makeTask({ status: 'Completed', completedAt: new Date() });
      repo.findOne.mockResolvedValue({ ...existing });

      await service.update(TENANT_ID, existing.id, {
        status: 'Open',
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Open',
          completedAt: null,
        }),
      );
    });

    it('should throw NotFoundException when task not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, 'nonexistent', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove an existing task', async () => {
      const task = makeTask();
      repo.findOne.mockResolvedValue(task);

      await service.remove(TENANT_ID, task.id);

      expect(repo.remove).toHaveBeenCalledWith(task);
    });

    it('should throw NotFoundException when task not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove(TENANT_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markOverdueTasks', () => {
    it('should mark past-due non-completed tasks as Overdue', async () => {
      const overdueTasks = [
        makeTask({ id: 'a', dueDate: '2020-01-01', status: 'Open' }),
        makeTask({ id: 'b', dueDate: '2020-06-15', status: 'In Progress' }),
      ];
      repo.find.mockResolvedValue(overdueTasks);

      const count = await service.markOverdueTasks(TENANT_ID);

      expect(count).toBe(2);
      expect(overdueTasks[0].status).toBe('Overdue');
      expect(overdueTasks[1].status).toBe('Overdue');
      expect(repo.save).toHaveBeenCalledWith(overdueTasks);
    });

    it('should return 0 when no tasks are overdue', async () => {
      repo.find.mockResolvedValue([]);

      const count = await service.markOverdueTasks(TENANT_ID);

      expect(count).toBe(0);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
