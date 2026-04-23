import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TimelineService } from './timeline.service';
import { Activity } from '../../entities/activity.entity';
import { Account } from '../../entities/account.entity';

describe('TimelineService', () => {
  let service: TimelineService;

  const tenantId = '11111111-1111-1111-1111-111111111111';
  const accountId = '22222222-2222-2222-2222-222222222222';

  const mockActivities: Partial<Activity>[] = [
    {
      id: 'a1',
      tenantId,
      entityType: 'note',
      entityId: accountId,
      summary: 'Note added',
      userId: 'u1',
      timestamp: new Date('2025-01-03'),
      metadata: {},
    },
    {
      id: 'a2',
      tenantId,
      entityType: 'call',
      entityId: accountId,
      summary: 'Call logged',
      userId: 'u1',
      timestamp: new Date('2025-01-02'),
      metadata: {},
    },
  ];

  const mockActivityRepo = {
    findAndCount: jest.fn(),
  };

  const mockAccountRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimelineService,
        { provide: getRepositoryToken(Activity), useValue: mockActivityRepo },
        { provide: getRepositoryToken(Account), useValue: mockAccountRepo },
      ],
    }).compile();

    service = module.get<TimelineService>(TimelineService);
    jest.clearAllMocks();
  });

  it('should return paginated timeline for an account', async () => {
    mockAccountRepo.findOne.mockResolvedValue({ id: accountId, tenantId });
    mockActivityRepo.findAndCount.mockResolvedValue([mockActivities, 2]);

    const result = await service.getTimeline(tenantId, accountId, 1, 20);

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(mockActivityRepo.findAndCount).toHaveBeenCalledWith({
      where: { tenantId, entityId: accountId },
      order: { timestamp: 'DESC' },
      skip: 0,
      take: 20,
    });
  });

  it('should throw NotFoundException if account does not exist', async () => {
    mockAccountRepo.findOne.mockResolvedValue(null);

    await expect(
      service.getTimeline(tenantId, accountId),
    ).rejects.toThrow(NotFoundException);
  });

  it('should respect pagination params', async () => {
    mockAccountRepo.findOne.mockResolvedValue({ id: accountId, tenantId });
    mockActivityRepo.findAndCount.mockResolvedValue([[], 0]);

    await service.getTimeline(tenantId, accountId, 3, 10);

    expect(mockActivityRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });
});
