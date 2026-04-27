import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { Opportunity } from '../../entities/opportunity.entity';
import { Lead } from '../../entities/lead.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { SalesTarget } from '../../entities/sales-target.entity';

describe('ReportsService', () => {
  let service: ReportsService;

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
    getMany: jest.fn(),
  };

  const mockOppRepo = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    count: jest.fn(),
  };
  const mockLeadRepo = { count: jest.fn() };
  const mockStageRepo = { find: jest.fn() };
  const mockTargetRepo = { createQueryBuilder: jest.fn(() => mockQueryBuilder) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(Opportunity), useValue: mockOppRepo },
        { provide: getRepositoryToken(Lead), useValue: mockLeadRepo },
        { provide: getRepositoryToken(PipelineStage), useValue: mockStageRepo },
        { provide: getRepositoryToken(SalesTarget), useValue: mockTargetRepo },
      ],
    }).compile();
    service = module.get(ReportsService);
    jest.clearAllMocks();
  });

  describe('getDashboardKPIs', () => {
    it('should return KPI data', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ total: '5000000' });
      mockLeadRepo.count.mockResolvedValue(38);
      mockOppRepo.count.mockResolvedValue(28);
      const result = await service.getDashboardKPIs('tenant-1', 'month');
      expect(result).toHaveProperty('closedWon');
      expect(result).toHaveProperty('newLeads');
      expect(result).toHaveProperty('conversionRate');
      expect(result).toHaveProperty('activeDeals');
    });
  });

  describe('getPipelineSummary', () => {
    it('should return pipeline stages with values', async () => {
      mockStageRepo.find.mockResolvedValue([
        { id: 's1', name: 'New', color: '#0176D3', probability: 10, sortOrder: 1 },
      ]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ count: '5', total: '1000000' });
      const result = await service.getPipelineSummary('tenant-1');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('dealCount');
      expect(result[0]).toHaveProperty('weightedValue');
    });
  });

  describe('getLeadConversionFunnel', () => {
    it('should return funnel data', async () => {
      mockLeadRepo.count.mockResolvedValue(10);
      const result = await service.getLeadConversionFunnel('tenant-1');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('funnel');
      expect(result.funnel).toHaveLength(6);
    });
  });

  describe('getAgingDeals', () => {
    it('should return overdue deals', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([
        { id: 'o1', dealName: 'Test', expectedCloseDate: '2024-01-01', estimatedValue: 100000 },
      ]);
      const result = await service.getAgingDeals('tenant-1');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('daysOverdue');
    });
  });

  describe('getSalesForecast', () => {
    it('should return forecast with weighted values', async () => {
      mockStageRepo.find.mockResolvedValue([
        { id: 's1', name: 'New', probability: 10, sortOrder: 1 },
      ]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ total: '500000' });
      const result = await service.getSalesForecast('tenant-1');
      expect(result).toHaveProperty('forecast');
      expect(result).toHaveProperty('totalWeightedForecast');
    });
  });
});
