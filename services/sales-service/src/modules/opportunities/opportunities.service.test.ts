import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { Opportunity } from '../../entities/opportunity.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { OpportunityHistory } from '../../entities/opportunity-history.entity';

const TENANT = '00000000-0000-0000-0000-000000000001';
const USER = '00000000-0000-0000-0000-000000000099';
const STAGE_ID = 'stage-qual';
const WON_STAGE_ID = 'stage-won';

function makeStage(overrides: Partial<PipelineStage> = {}): PipelineStage {
  return {
    id: STAGE_ID,
    tenantId: TENANT,
    name: 'Qualified',
    sortOrder: 3,
    probability: 40,
    color: '#FF9500',
    opportunities: [],
    ...overrides,
  } as PipelineStage;
}

function makeOpp(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp-1',
    tenantId: TENANT,
    dealName: 'Test Deal',
    accountId: 'acc-1',
    contactId: null,
    estimatedValue: 100000,
    stageId: STAGE_ID,
    weightedValue: 40000,
    expectedCloseDate: new Date('2025-06-30'),
    closedReason: null,
    closedNotes: null,
    assignedTo: USER,
    aiCloseProbability: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    stage: makeStage(),
    history: [],
    ...overrides,
  } as Opportunity;
}

describe('OpportunitiesService', () => {
  let service: OpportunitiesService;
  let oppRepo: Record<string, jest.Mock>;
  let stageRepo: Record<string, jest.Mock>;
  let historyRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    oppRepo = {
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve(Array.isArray(e) ? e : { id: 'opp-1', ...e })),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      find: jest.fn(),
    };
    stageRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve(e)),
      delete: jest.fn(),
    };
    historyRepo = {
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve(e)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpportunitiesService,
        { provide: getRepositoryToken(Opportunity), useValue: oppRepo },
        { provide: getRepositoryToken(PipelineStage), useValue: stageRepo },
        { provide: getRepositoryToken(OpportunityHistory), useValue: historyRepo },
      ],
    }).compile();

    service = module.get<OpportunitiesService>(OpportunitiesService);
  });

  describe('create', () => {
    it('should create an opportunity with calculated weightedValue', async () => {
      stageRepo.findOne.mockResolvedValue(makeStage());

      const result = await service.create(TENANT, {
        dealName: 'Big Deal',
        accountId: 'acc-1',
        estimatedValue: 500000,
        stageId: STAGE_ID,
        expectedCloseDate: '2025-12-31',
        assignedTo: USER,
      });

      expect(oppRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT,
          dealName: 'Big Deal',
          estimatedValue: 500000,
          weightedValue: 200000, // 500000 * 40 / 100
        }),
      );
      expect(oppRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid stage', async () => {
      stageRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(TENANT, {
          dealName: 'Deal',
          accountId: 'acc-1',
          estimatedValue: 100000,
          stageId: 'bad-stage',
          expectedCloseDate: '2025-12-31',
          assignedTo: USER,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated opportunities', async () => {
      const opps = [makeOpp()];
      oppRepo.findAndCount.mockResolvedValue([opps, 1]);

      const result = await service.findAll(TENANT, 1, 20);
      expect(result.data).toEqual(opps);
      expect(result.total).toBe(1);
    });

    it('should filter by stageId', async () => {
      oppRepo.findAndCount.mockResolvedValue([[], 0]);
      await service.findAll(TENANT, 1, 20, STAGE_ID);

      expect(oppRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ stageId: STAGE_ID }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return opportunity with history', async () => {
      oppRepo.findOne.mockResolvedValue(makeOpp());
      const result = await service.findOne(TENANT, 'opp-1');
      expect(result.id).toBe('opp-1');
    });

    it('should throw NotFoundException when not found', async () => {
      oppRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(TENANT, 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStage', () => {
    it('should update stage, recalculate weightedValue, and record history', async () => {
      const newStage = makeStage({ id: 'stage-neg', name: 'Negotiation', probability: 80 });
      oppRepo.findOne.mockResolvedValue(makeOpp());
      stageRepo.findOne.mockResolvedValue(newStage);

      await service.updateStage(TENANT, 'opp-1', { stageId: 'stage-neg' }, USER);

      expect(oppRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          stageId: 'stage-neg',
          weightedValue: 80000, // 100000 * 80 / 100
        }),
      );
      expect(historyRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid new stage', async () => {
      oppRepo.findOne.mockResolvedValue(makeOpp());
      stageRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStage(TENANT, 'opp-1', { stageId: 'bad' }, USER),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('close', () => {
    it('should close as Won with reason and notes', async () => {
      const wonStage = makeStage({ id: WON_STAGE_ID, name: 'Won', probability: 100 });
      oppRepo.findOne.mockResolvedValue(makeOpp());
      stageRepo.findOne.mockResolvedValue(wonStage);

      await service.close(TENANT, 'opp-1', {
        outcome: 'Won',
        reason: 'Customer accepted proposal',
        notes: 'Signed contract',
      }, USER);

      expect(oppRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          stageId: WON_STAGE_ID,
          closedReason: 'Customer accepted proposal',
          closedNotes: 'Signed contract',
          weightedValue: 100000, // 100000 * 100 / 100
        }),
      );
      expect(historyRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when reason is empty', async () => {
      oppRepo.findOne.mockResolvedValue(makeOpp());

      await expect(
        service.close(TENANT, 'opp-1', {
          outcome: 'Lost',
          reason: '  ',
        }, USER),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('calculateWeightedValue', () => {
    it('should calculate estimatedValue * probability / 100', () => {
      expect(service.calculateWeightedValue(100000, 40)).toBe(40000);
      expect(service.calculateWeightedValue(250000, 80)).toBe(200000);
      expect(service.calculateWeightedValue(100000, 0)).toBe(0);
      expect(service.calculateWeightedValue(100000, 100)).toBe(100000);
    });

    it('should handle decimal precision', () => {
      expect(service.calculateWeightedValue(33333, 33)).toBe(10999.89);
    });
  });
});
