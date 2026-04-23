import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { Activity } from '../../entities/activity.entity';
import { Task } from '../../entities/task.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000099';

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: '00000000-0000-0000-0000-000000000010',
    tenantId: TENANT_ID,
    entityType: 'call',
    entityId: '00000000-0000-0000-0000-000000000020',
    summary: 'Call - Connected (5 min)',
    userId: USER_ID,
    timestamp: new Date('2025-06-15T10:00:00Z'),
    metadata: { duration: 5, outcome: 'Connected', notes: null },
    ...overrides,
  } as Activity;
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '00000000-0000-0000-0000-000000000030',
    tenantId: TENANT_ID,
    title: 'Follow up',
    description: null,
    dueDate: '2025-06-15',
    priority: 'High',
    status: 'Open',
    assignedTo: USER_ID,
    accountId: null,
    contactId: null,
    opportunityId: null,
    completedAt: null,
    createdAt: new Date('2025-06-01'),
    ...overrides,
  } as Task;
}

describe('ActivitiesService', () => {
  let service: ActivitiesService;
  let activityRepo: Record<string, jest.Mock>;
  let taskRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    activityRepo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) =>
        Promise.resolve({ ...makeActivity(), ...entity }),
      ),
      find: jest.fn().mockResolvedValue([]),
    };

    taskRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        { provide: getRepositoryToken(Activity), useValue: activityRepo },
        { provide: getRepositoryToken(Task), useValue: taskRepo },
      ],
    }).compile();

    service = module.get(ActivitiesService);
  });

  describe('logCall', () => {
    it('should create a call activity with accountId', async () => {
      const dto = {
        duration: 10,
        outcome: 'Connected' as const,
        notes: 'Discussed proposal',
        accountId: '00000000-0000-0000-0000-000000000020',
      };

      const result = await service.logCall(TENANT_ID, USER_ID, dto);

      expect(activityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          entityType: 'call',
          entityId: dto.accountId,
          userId: USER_ID,
          metadata: expect.objectContaining({
            duration: 10,
            outcome: 'Connected',
            notes: 'Discussed proposal',
            accountId: dto.accountId,
            contactId: null,
          }),
        }),
      );
      expect(activityRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should create a call activity with contactId', async () => {
      const dto = {
        duration: 3,
        outcome: 'No Answer' as const,
        contactId: '00000000-0000-0000-0000-000000000040',
      };

      await service.logCall(TENANT_ID, USER_ID, dto);

      expect(activityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: dto.contactId,
          metadata: expect.objectContaining({
            duration: 3,
            outcome: 'No Answer',
            notes: null,
            contactId: dto.contactId,
            accountId: null,
          }),
        }),
      );
    });

    it('should prefer accountId over contactId for entityId', async () => {
      const dto = {
        duration: 5,
        outcome: 'Left Voicemail' as const,
        accountId: '00000000-0000-0000-0000-000000000020',
        contactId: '00000000-0000-0000-0000-000000000040',
      };

      await service.logCall(TENANT_ID, USER_ID, dto);

      expect(activityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: dto.accountId,
        }),
      );
    });

    it('should throw BadRequestException when neither accountId nor contactId provided', async () => {
      const dto = {
        duration: 5,
        outcome: 'Busy' as const,
      };

      await expect(service.logCall(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should generate a summary with outcome and duration', async () => {
      const dto = {
        duration: 15,
        outcome: 'Connected' as const,
        accountId: '00000000-0000-0000-0000-000000000020',
      };

      await service.logCall(TENANT_ID, USER_ID, dto);

      expect(activityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: 'Call - Connected (15 min)',
        }),
      );
    });
  });

  describe('getCalendarView', () => {
    it('should return activities and tasks grouped by date', async () => {
      const activity = makeActivity({
        timestamp: new Date('2025-06-15T10:00:00Z'),
      });
      const task = makeTask({ dueDate: '2025-06-15' });

      activityRepo.find.mockResolvedValue([activity]);
      taskRepo.find.mockResolvedValue([task]);

      const result = await service.getCalendarView(
        TENANT_ID,
        '2025-06-14T00:00:00Z',
        '2025-06-16T23:59:59Z',
        'week',
      );

      expect(result.view).toBe('week');
      expect(result.entries['2025-06-15']).toHaveLength(2);
      expect(result.entries['2025-06-15'][0].type).toBe('call');
      expect(result.entries['2025-06-15'][1].type).toBe('task');
    });

    it('should return empty entries when no data in range', async () => {
      activityRepo.find.mockResolvedValue([]);
      taskRepo.find.mockResolvedValue([]);

      const result = await service.getCalendarView(
        TENANT_ID,
        '2025-06-01T00:00:00Z',
        '2025-06-07T23:59:59Z',
        'day',
      );

      expect(result.view).toBe('day');
      expect(result.entries).toEqual({});
    });

    it('should group entries across multiple dates', async () => {
      const activities = [
        makeActivity({
          id: 'a1',
          timestamp: new Date('2025-06-15T10:00:00Z'),
        }),
        makeActivity({
          id: 'a2',
          timestamp: new Date('2025-06-16T14:00:00Z'),
        }),
      ];
      activityRepo.find.mockResolvedValue(activities);
      taskRepo.find.mockResolvedValue([]);

      const result = await service.getCalendarView(
        TENANT_ID,
        '2025-06-14T00:00:00Z',
        '2025-06-17T23:59:59Z',
        'month',
      );

      expect(result.entries['2025-06-15']).toHaveLength(1);
      expect(result.entries['2025-06-16']).toHaveLength(1);
    });

    it('should throw BadRequestException for invalid dates', async () => {
      await expect(
        service.getCalendarView(TENANT_ID, 'invalid', '2025-06-07', 'week'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include task metadata (priority, status, assignedTo)', async () => {
      const task = makeTask({
        priority: 'High',
        status: 'Open',
        assignedTo: USER_ID,
      });
      taskRepo.find.mockResolvedValue([task]);
      activityRepo.find.mockResolvedValue([]);

      const result = await service.getCalendarView(
        TENANT_ID,
        '2025-06-14T00:00:00Z',
        '2025-06-16T23:59:59Z',
        'week',
      );

      const entry = result.entries['2025-06-15'][0];
      expect(entry.metadata).toEqual({
        priority: 'High',
        status: 'Open',
        assignedTo: USER_ID,
      });
    });
  });
});
