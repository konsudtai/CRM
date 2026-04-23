import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PipelineService, StageSummary } from './pipeline.service';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { Opportunity } from '../../entities/opportunity.entity';

const TENANT = '00000000-0000-0000-0000-000000000001';

function makeStage(overrides: Partial<PipelineStage> = {}): PipelineStage {
  return {
    id: 'stage-1',
    tenantId: TENANT,
    name: 'Qualified',
    sortOrder: 1,
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
    dealName: 'Deal',
    accountId: 'acc-1',
    contactId: null,
    estimatedValue: 100000,
    stageId: 'stage-1',
    weightedValue: 40000,
    expectedCloseDate: new Date(),
    closedReason: null,
    closedNotes: null,
    assignedTo: 'user-1',
    aiCloseProbability: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    stage: makeStage(),
    history: [],
    ...overrides,
  } as Opportunity;
}

describe('PipelineService', () => {
  let service: PipelineService;
  let stageRepo: Record<string, jest.Mock>;
  let oppRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    stageRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((e) => Promise.resolve(e)),
      delete: jest.fn(),
    };
    oppRepo = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineService,
        { provide: getRepositoryToken(PipelineStage), useValue: stageRepo },
        { provide: getRepositoryToken(Opportunity), useValue: oppRepo },
      ],
    }).compile();

    service = module.get<PipelineService>(PipelineService);
  });

  describe('getStages', () => {
    it('should return stages ordered by sortOrder', async () => {
      const stages = [
        makeStage({ id: 's1', sortOrder: 1 }),
        makeStage({ id: 's2', sortOrder: 2 }),
      ];
      stageRepo.find.mockResolvedValue(stages);

      const result = await service.getStages(TENANT);
      expect(result).toEqual(stages);
      expect(stageRepo.find).toHaveBeenCalledWith({
        where: { tenantId: TENANT },
        order: { sortOrder: 'ASC' },
      });
    });
  });

  describe('updateStages', () => {
    it('should replace all stages for tenant', async () => {
      const newStages = [
        { name: 'New', sortOrder: 1, probability: 10 },
        { name: 'Won', sortOrder: 2, probability: 100 },
      ];

      await service.updateStages(TENANT, newStages);

      expect(stageRepo.delete).toHaveBeenCalledWith({ tenantId: TENANT });
      expect(stageRepo.save).toHaveBeenCalled();
      const saved = stageRepo.save.mock.calls[0][0];
      expect(saved).toHaveLength(2);
      expect(saved[0].name).toBe('New');
      expect(saved[1].name).toBe('Won');
    });
  });

  describe('getSummary', () => {
    it('should aggregate per-stage totalValue, weightedValue, dealCount', async () => {
      const stages = [
        makeStage({ id: 's1', name: 'Qualified', probability: 40, sortOrder: 1 }),
        makeStage({ id: 's2', name: 'Negotiation', probability: 80, sortOrder: 2 }),
      ];
      const opps = [
        makeOpp({ id: 'o1', stageId: 's1', estimatedValue: 100000 }),
        makeOpp({ id: 'o2', stageId: 's1', estimatedValue: 200000 }),
        makeOpp({ id: 'o3', stageId: 's2', estimatedValue: 500000 }),
      ];

      stageRepo.find.mockResolvedValue(stages);
      oppRepo.find.mockResolvedValue(opps);

      const result: StageSummary[] = await service.getSummary(TENANT);

      expect(result).toHaveLength(2);

      // Stage s1: Qualified
      expect(result[0].stageId).toBe('s1');
      expect(result[0].totalValue).toBe(300000);
      expect(result[0].weightedValue).toBe(120000); // 300000 * 40 / 100
      expect(result[0].dealCount).toBe(2);

      // Stage s2: Negotiation
      expect(result[1].stageId).toBe('s2');
      expect(result[1].totalValue).toBe(500000);
      expect(result[1].weightedValue).toBe(400000); // 500000 * 80 / 100
      expect(result[1].dealCount).toBe(1);
    });

    it('should return zero values for stages with no opportunities', async () => {
      stageRepo.find.mockResolvedValue([makeStage()]);
      oppRepo.find.mockResolvedValue([]);

      const result = await service.getSummary(TENANT);
      expect(result[0].totalValue).toBe(0);
      expect(result[0].weightedValue).toBe(0);
      expect(result[0].dealCount).toBe(0);
    });
  });
});
