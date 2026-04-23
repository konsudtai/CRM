import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LeadsService, ImportResult } from './leads.service';
import { LeadAssignmentService } from './lead-assignment.service';
import { Lead } from '../../entities/lead.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { BulkAction } from './dto/bulk-leads.dto';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000099';

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-1',
    tenantId: TENANT_ID,
    name: 'Test Lead',
    companyName: null,
    email: 'test@example.com',
    phone: '0812345678',
    lineId: null,
    source: 'website',
    status: 'New',
    assignedTo: null,
    aiScore: null,
    metadata: { statusHistory: [{ status: 'New', timestamp: '2025-01-01T00:00:00.000Z' }] },
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    scores: [],
    ...overrides,
  } as Lead;
}

describe('LeadsService', () => {
  let service: LeadsService;
  let leadRepo: Record<string, jest.Mock>;
  let stageRepo: Record<string, jest.Mock>;
  let mockAssignmentService: { getNextRep: jest.Mock };

  beforeEach(async () => {
    leadRepo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) =>
        Promise.resolve(Array.isArray(entity) ? entity : { id: 'lead-1', ...entity }),
      ),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
    };

    stageRepo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entities) => Promise.resolve(entities)),
      find: jest.fn(),
    };

    mockAssignmentService = {
      getNextRep: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: getRepositoryToken(Lead), useValue: leadRepo },
        { provide: getRepositoryToken(PipelineStage), useValue: stageRepo },
        { provide: LeadAssignmentService, useValue: mockAssignmentService },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  describe('create', () => {
    it('should create a lead with source and default status New', async () => {
      const result = await service.create(TENANT_ID, {
        name: 'Alice',
        source: 'website',
        email: 'alice@example.com',
      });

      expect(leadRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          name: 'Alice',
          source: 'website',
          status: 'New',
        }),
      );
      expect(leadRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should auto-assign via round-robin when autoAssign is true', async () => {
      mockAssignmentService.getNextRep.mockResolvedValue('rep-a');

      const result = await service.create(TENANT_ID, {
        name: 'Bob',
        source: 'website',
        autoAssign: true,
        activeRepIds: ['rep-a', 'rep-b'],
      });

      expect(mockAssignmentService.getNextRep).toHaveBeenCalledWith(TENANT_ID, ['rep-a', 'rep-b']);
      expect(leadRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: 'rep-a' }),
      );
    });

    it('should not auto-assign when autoAssign is false', async () => {
      await service.create(TENANT_ID, {
        name: 'Carol',
        source: 'website',
      });

      expect(mockAssignmentService.getNextRep).not.toHaveBeenCalled();
      expect(leadRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: null }),
      );
    });
  });

  describe('importLeads', () => {
    it('should import valid rows and reject invalid ones', async () => {
      const rows = [
        { name: 'Valid Lead', phone: '0812345678' },
        { name: '', email: '' },           // missing name and contact
        { name: 'Email Only', email: 'e@x.com' },
        { phone: '0899999999' },           // missing name
      ];

      const result: ImportResult = await service.importLeads(TENANT_ID, rows);

      expect(result.created).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].row).toBe(2);
      expect(result.errors[0].messages).toContain('name is required');
      expect(result.errors[1].row).toBe(4);
      expect(result.errors[1].messages).toContain('name is required');
    });

    it('should reject rows missing both phone and email', async () => {
      const rows = [{ name: 'No Contact' }];
      const result = await service.importLeads(TENANT_ID, rows);

      expect(result.created).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].messages).toContain('phone or email is required');
    });

    it('should return zero errors for all valid rows', async () => {
      const rows = [
        { name: 'A', phone: '0811111111' },
        { name: 'B', email: 'b@x.com' },
      ];
      const result = await service.importLeads(TENANT_ID, rows);

      expect(result.created).toBe(2);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('findAll', () => {
    it('should return paginated leads', async () => {
      const leads = [makeLead()];
      leadRepo.findAndCount.mockResolvedValue([leads, 1]);

      const result = await service.findAll(TENANT_ID, 1, 20);

      expect(result.data).toEqual(leads);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter by status when provided', async () => {
      leadRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(TENANT_ID, 1, 20, 'Qualified');

      expect(leadRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'Qualified' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a lead by id', async () => {
      const lead = makeLead();
      leadRepo.findOne.mockResolvedValue(lead);

      const result = await service.findOne(TENANT_ID, 'lead-1');
      expect(result).toEqual(lead);
    });

    it('should throw NotFoundException when lead not found', async () => {
      leadRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(TENANT_ID, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update lead fields', async () => {
      leadRepo.findOne.mockResolvedValue(makeLead());

      await service.update(TENANT_ID, 'lead-1', { name: 'Updated' });

      expect(leadRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated' }),
      );
    });
  });

  describe('updateStatus', () => {
    it('should update status and record history in metadata', async () => {
      const lead = makeLead();
      leadRepo.findOne.mockResolvedValue(lead);

      const result = await service.updateStatus(
        TENANT_ID,
        'lead-1',
        { status: 'Contacted' },
        USER_ID,
      );

      expect(leadRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Contacted' }),
      );
      const saved = leadRepo.save.mock.calls[0][0];
      const history = saved.metadata.statusHistory;
      expect(history.length).toBeGreaterThan(1);
      expect(history[history.length - 1].to).toBe('Contacted');
      expect(history[history.length - 1].userId).toBe(USER_ID);
    });
  });

  describe('assign', () => {
    it('should assign lead to a user', async () => {
      leadRepo.findOne.mockResolvedValue(makeLead());

      await service.assign(TENANT_ID, 'lead-1', USER_ID);

      expect(leadRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: USER_ID }),
      );
    });
  });

  describe('bulk', () => {
    it('should bulk assign leads', async () => {
      leadRepo.find.mockResolvedValue([makeLead(), makeLead({ id: 'lead-2' })]);

      const result = await service.bulk(
        TENANT_ID,
        BulkAction.ASSIGN,
        ['lead-1', 'lead-2'],
        USER_ID,
        USER_ID,
      );

      expect(result.affected).toBe(2);
      expect(leadRepo.save).toHaveBeenCalled();
    });

    it('should bulk update status with history', async () => {
      leadRepo.find.mockResolvedValue([makeLead()]);

      await service.bulk(
        TENANT_ID,
        BulkAction.STATUS,
        ['lead-1'],
        'Won',
        USER_ID,
      );

      const saved = leadRepo.save.mock.calls[0][0];
      expect(saved[0].status).toBe('Won');
    });

    it('should bulk delete leads', async () => {
      leadRepo.find.mockResolvedValue([makeLead()]);

      await service.bulk(
        TENANT_ID,
        BulkAction.DELETE,
        ['lead-1'],
        '',
        USER_ID,
      );

      expect(leadRepo.remove).toHaveBeenCalled();
    });

    it('should throw BadRequestException when no leads match', async () => {
      leadRepo.find.mockResolvedValue([]);

      await expect(
        service.bulk(TENANT_ID, BulkAction.ASSIGN, ['missing'], USER_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('seedDefaultStages', () => {
    it('should create 7 default stages when none exist', async () => {
      stageRepo.find.mockResolvedValue([]);
      stageRepo.save.mockImplementation((stages) => Promise.resolve(stages));

      const result = await service.seedDefaultStages(TENANT_ID);

      expect(stageRepo.save).toHaveBeenCalled();
      expect(result).toHaveLength(7);
    });

    it('should return existing stages without creating new ones', async () => {
      const existing = [{ id: 's1', name: 'New', tenantId: TENANT_ID }];
      stageRepo.find.mockResolvedValue(existing);

      const result = await service.seedDefaultStages(TENANT_ID);

      expect(stageRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual(existing);
    });
  });
});
