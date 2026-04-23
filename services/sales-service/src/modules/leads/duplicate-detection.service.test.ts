import { DuplicateDetectionService } from './duplicate-detection.service';
import { Lead } from '../../entities/lead.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-1',
    tenantId: TENANT_ID,
    name: 'Test Lead',
    companyName: null,
    email: null,
    phone: null,
    lineId: null,
    source: 'website',
    status: 'New',
    assignedTo: null,
    aiScore: null,
    metadata: {},
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    scores: [],
    ...overrides,
  } as Lead;
}

describe('DuplicateDetectionService', () => {
  let service: DuplicateDetectionService;
  let mockRepo: { findOne: jest.Mock; find: jest.Mock };

  beforeEach(() => {
    mockRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    service = new DuplicateDetectionService(mockRepo as any);
  });

  describe('normalize', () => {
    it('should return null for null/undefined/empty', () => {
      expect(DuplicateDetectionService.normalize(null)).toBeNull();
      expect(DuplicateDetectionService.normalize(undefined)).toBeNull();
      expect(DuplicateDetectionService.normalize('')).toBeNull();
      expect(DuplicateDetectionService.normalize('   ')).toBeNull();
    });

    it('should lowercase and collapse whitespace', () => {
      expect(DuplicateDetectionService.normalize('  Hello   World  ')).toBe('hello world');
      expect(DuplicateDetectionService.normalize('ABC')).toBe('abc');
    });
  });

  describe('findDuplicates', () => {
    it('should return empty when source lead not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await service.findDuplicates(TENANT_ID, 'missing');
      expect(result).toEqual([]);
    });

    it('should return empty when source lead has no matchable fields', async () => {
      mockRepo.findOne.mockResolvedValue(makeLead({ email: null, phone: null, companyName: null }));
      const result = await service.findDuplicates(TENANT_ID, 'lead-1');
      expect(result).toEqual([]);
    });

    it('should detect duplicate by email (case-insensitive)', async () => {
      const source = makeLead({ id: 'lead-1', email: 'Test@Example.COM' });
      const candidate = makeLead({ id: 'lead-2', email: 'test@example.com' });

      mockRepo.findOne.mockResolvedValue(source);
      mockRepo.find.mockResolvedValue([candidate]);

      const result = await service.findDuplicates(TENANT_ID, 'lead-1');

      expect(result).toHaveLength(1);
      expect(result[0].leadId).toBe('lead-2');
      expect(result[0].matchedFields).toContain('email');
    });

    it('should detect duplicate by phone (whitespace-normalized)', async () => {
      const source = makeLead({ id: 'lead-1', phone: '081 234 5678' });
      const candidate = makeLead({ id: 'lead-2', phone: '081  234  5678' });

      mockRepo.findOne.mockResolvedValue(source);
      mockRepo.find.mockResolvedValue([candidate]);

      const result = await service.findDuplicates(TENANT_ID, 'lead-1');

      expect(result).toHaveLength(1);
      expect(result[0].matchedFields).toContain('phone');
    });

    it('should detect duplicate by company name (case-insensitive, whitespace-normalized)', async () => {
      const source = makeLead({ id: 'lead-1', companyName: '  Acme   Corp  ' });
      const candidate = makeLead({ id: 'lead-2', companyName: 'acme corp' });

      mockRepo.findOne.mockResolvedValue(source);
      mockRepo.find.mockResolvedValue([candidate]);

      const result = await service.findDuplicates(TENANT_ID, 'lead-1');

      expect(result).toHaveLength(1);
      expect(result[0].matchedFields).toContain('companyName');
    });

    it('should report multiple matched fields', async () => {
      const source = makeLead({
        id: 'lead-1',
        email: 'test@example.com',
        phone: '0812345678',
        companyName: 'Acme',
      });
      const candidate = makeLead({
        id: 'lead-2',
        email: 'TEST@EXAMPLE.COM',
        phone: '0812345678',
        companyName: 'acme',
      });

      mockRepo.findOne.mockResolvedValue(source);
      mockRepo.find.mockResolvedValue([candidate]);

      const result = await service.findDuplicates(TENANT_ID, 'lead-1');

      expect(result).toHaveLength(1);
      expect(result[0].matchedFields).toContain('email');
      expect(result[0].matchedFields).toContain('phone');
      expect(result[0].matchedFields).toContain('companyName');
    });

    it('should not flag non-matching leads', async () => {
      const source = makeLead({ id: 'lead-1', email: 'a@example.com' });
      const candidate = makeLead({ id: 'lead-2', email: 'b@example.com' });

      mockRepo.findOne.mockResolvedValue(source);
      mockRepo.find.mockResolvedValue([candidate]);

      const result = await service.findDuplicates(TENANT_ID, 'lead-1');
      expect(result).toHaveLength(0);
    });

    it('should find multiple duplicates', async () => {
      const source = makeLead({ id: 'lead-1', email: 'shared@example.com' });
      const dup1 = makeLead({ id: 'lead-2', email: 'shared@example.com' });
      const dup2 = makeLead({ id: 'lead-3', email: 'SHARED@EXAMPLE.COM' });
      const nonDup = makeLead({ id: 'lead-4', email: 'other@example.com' });

      mockRepo.findOne.mockResolvedValue(source);
      mockRepo.find.mockResolvedValue([dup1, dup2, nonDup]);

      const result = await service.findDuplicates(TENANT_ID, 'lead-1');

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.leadId).sort()).toEqual(['lead-2', 'lead-3']);
    });

    it('should not match on null/empty fields', async () => {
      const source = makeLead({ id: 'lead-1', email: 'a@b.com', phone: null });
      const candidate = makeLead({ id: 'lead-2', email: 'x@y.com', phone: null });

      mockRepo.findOne.mockResolvedValue(source);
      mockRepo.find.mockResolvedValue([candidate]);

      const result = await service.findDuplicates(TENANT_ID, 'lead-1');
      // phone is null on both — should NOT match
      expect(result).toHaveLength(0);
    });
  });
});
