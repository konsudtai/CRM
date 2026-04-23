import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { TargetsService } from './targets.service';
import { SalesTarget } from '../../entities/sales-target.entity';
import { Opportunity } from '../../entities/opportunity.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';

const TENANT = '00000000-0000-0000-0000-000000000001';
const USER = '00000000-0000-0000-0000-000000000099';

function makeTarget(overrides: Partial<SalesTarget> = {}): SalesTarget {
  return {
    id: 'target-1',
    tenantId: TENANT,
    userId: USER,
    period: 'monthly' as const,
    year: 2025,
    month: 6,
    quarter: null,
    targetAmount: 1000000,
    achievedAmount: 0,
    ...overrides,
  } as SalesTarget;
}

describe('TargetsService', () => {
  let service: TargetsService;
  let targetRepo: Record<string, jest.Mock>;
  let oppRepo: Record<string, jest.Mock>;
  let stageRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    targetRepo = {
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve({ id: 'target-1', ...e })),
      find: jest.fn(),
    };
    oppRepo = {
      find: jest.fn(),
    };
    stageRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TargetsService,
        { provide: getRepositoryToken(SalesTarget), useValue: targetRepo },
        { provide: getRepositoryToken(Opportunity), useValue: oppRepo },
        { provide: getRepositoryToken(PipelineStage), useValue: stageRepo },
      ],
    }).compile();

    service = module.get<TargetsService>(TargetsService);
  });

  describe('create', () => {
    it('should create a monthly target', async () => {
      const result = await service.create(TENANT, {
        userId: USER,
        period: 'monthly',
        year: 2025,
        month: 6,
        targetAmount: 1000000,
      });

      expect(targetRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT,
          userId: USER,
          period: 'monthly',
          year: 2025,
          month: 6,
          targetAmount: 1000000,
          achievedAmount: 0,
        }),
      );
    });

    it('should throw when monthly target missing month', async () => {
      await expect(
        service.create(TENANT, {
          userId: USER,
          period: 'monthly',
          year: 2025,
          targetAmount: 500000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when quarterly target missing quarter', async () => {
      await expect(
        service.create(TENANT, {
          userId: USER,
          period: 'quarterly',
          year: 2025,
          targetAmount: 500000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a quarterly target', async () => {
      await service.create(TENANT, {
        userId: USER,
        period: 'quarterly',
        year: 2025,
        quarter: 2,
        targetAmount: 3000000,
      });

      expect(targetRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          period: 'quarterly',
          quarter: 2,
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return targets with progress from won opportunities', async () => {
      const wonStage = { id: 'stage-won', tenantId: TENANT, name: 'Won', probability: 100 };
      stageRepo.findOne.mockResolvedValue(wonStage);
      targetRepo.find.mockResolvedValue([makeTarget()]);
      oppRepo.find.mockResolvedValue([
        {
          id: 'opp-1',
          tenantId: TENANT,
          assignedTo: USER,
          stageId: 'stage-won',
          estimatedValue: 400000,
          updatedAt: new Date('2025-06-15'),
        },
      ]);

      const result = await service.findAll(TENANT);

      expect(result).toHaveLength(1);
      expect(result[0].achievedAmount).toBe(400000);
      expect(result[0].progress).toBe(40); // 400000 / 1000000 * 100
    });

    it('should return 0 progress when no Won stage exists', async () => {
      stageRepo.findOne.mockResolvedValue(null);
      targetRepo.find.mockResolvedValue([makeTarget()]);

      const result = await service.findAll(TENANT);
      expect(result[0].progress).toBe(0);
    });

    it('should not count opportunities from other reps', async () => {
      const wonStage = { id: 'stage-won', tenantId: TENANT, name: 'Won', probability: 100 };
      stageRepo.findOne.mockResolvedValue(wonStage);
      targetRepo.find.mockResolvedValue([makeTarget()]);
      oppRepo.find.mockResolvedValue([
        {
          id: 'opp-1',
          tenantId: TENANT,
          assignedTo: 'other-user',
          stageId: 'stage-won',
          estimatedValue: 500000,
          updatedAt: new Date('2025-06-15'),
        },
      ]);

      const result = await service.findAll(TENANT);
      expect(result[0].achievedAmount).toBe(0);
      expect(result[0].progress).toBe(0);
    });
  });
});
