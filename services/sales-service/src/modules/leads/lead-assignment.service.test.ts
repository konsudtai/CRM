import { LeadAssignmentService } from './lead-assignment.service';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

describe('LeadAssignmentService', () => {
  let service: LeadAssignmentService;
  let counterStore: Record<string, number>;
  let mockRedis: { incr: jest.Mock };

  beforeEach(() => {
    counterStore = {};
    mockRedis = {
      incr: jest.fn((key: string) => {
        counterStore[key] = (counterStore[key] || 0) + 1;
        return Promise.resolve(counterStore[key]);
      }),
    };

    service = new LeadAssignmentService(mockRedis as any);
  });

  describe('assignRoundRobin', () => {
    it('should return empty array when no leads provided', async () => {
      const result = await service.assignRoundRobin(TENANT_ID, [], ['rep-a']);
      expect(result).toEqual([]);
    });

    it('should return empty array when no reps provided', async () => {
      const result = await service.assignRoundRobin(TENANT_ID, ['lead-1'], []);
      expect(result).toEqual([]);
    });

    it('should assign all leads to single rep when only one rep', async () => {
      const result = await service.assignRoundRobin(
        TENANT_ID,
        ['lead-1', 'lead-2', 'lead-3'],
        ['rep-a'],
      );

      expect(result).toHaveLength(3);
      expect(result.every((r) => r.assignedTo === 'rep-a')).toBe(true);
    });

    it('should distribute leads evenly across reps (N divisible by M)', async () => {
      const leads = ['lead-1', 'lead-2', 'lead-3', 'lead-4'];
      const reps = ['rep-b', 'rep-a']; // will be sorted to [rep-a, rep-b]

      const result = await service.assignRoundRobin(TENANT_ID, leads, reps);

      expect(result).toHaveLength(4);

      const counts: Record<string, number> = {};
      for (const r of result) {
        counts[r.assignedTo] = (counts[r.assignedTo] || 0) + 1;
      }

      // 4 leads / 2 reps = 2 each
      expect(counts['rep-a']).toBe(2);
      expect(counts['rep-b']).toBe(2);
    });

    it('should distribute leads with floor/ceil when N not divisible by M', async () => {
      const leads = ['lead-1', 'lead-2', 'lead-3', 'lead-4', 'lead-5'];
      const reps = ['rep-a', 'rep-b', 'rep-c'];

      const result = await service.assignRoundRobin(TENANT_ID, leads, reps);

      expect(result).toHaveLength(5);

      const counts: Record<string, number> = {};
      for (const r of result) {
        counts[r.assignedTo] = (counts[r.assignedTo] || 0) + 1;
      }

      // 5 leads / 3 reps: each gets floor(5/3)=1 or ceil(5/3)=2
      for (const rep of reps) {
        expect(counts[rep]).toBeGreaterThanOrEqual(1);
        expect(counts[rep]).toBeLessThanOrEqual(2);
      }
    });

    it('should cycle through reps in sorted order', async () => {
      const leads = ['lead-1', 'lead-2', 'lead-3'];
      const reps = ['rep-c', 'rep-a', 'rep-b'];

      const result = await service.assignRoundRobin(TENANT_ID, leads, reps);

      // Sorted order: rep-a, rep-b, rep-c
      expect(result[0].assignedTo).toBe('rep-a');
      expect(result[1].assignedTo).toBe('rep-b');
      expect(result[2].assignedTo).toBe('rep-c');
    });

    it('should continue rotation across multiple calls', async () => {
      const reps = ['rep-a', 'rep-b'];

      // First call: 1 lead
      const result1 = await service.assignRoundRobin(TENANT_ID, ['lead-1'], reps);
      expect(result1[0].assignedTo).toBe('rep-a');

      // Second call: 1 lead — should continue from where we left off
      const result2 = await service.assignRoundRobin(TENANT_ID, ['lead-2'], reps);
      expect(result2[0].assignedTo).toBe('rep-b');

      // Third call: wraps around
      const result3 = await service.assignRoundRobin(TENANT_ID, ['lead-3'], reps);
      expect(result3[0].assignedTo).toBe('rep-a');
    });

    it('should use tenant-specific Redis key', async () => {
      const tenant2 = '00000000-0000-0000-0000-000000000002';

      await service.assignRoundRobin(TENANT_ID, ['lead-1'], ['rep-a']);
      await service.assignRoundRobin(tenant2, ['lead-2'], ['rep-a']);

      expect(mockRedis.incr).toHaveBeenCalledWith(`lead_assignment_counter:${TENANT_ID}`);
      expect(mockRedis.incr).toHaveBeenCalledWith(`lead_assignment_counter:${tenant2}`);
    });
  });

  describe('getNextRep', () => {
    it('should return null when no reps provided', async () => {
      const result = await service.getNextRep(TENANT_ID, []);
      expect(result).toBeNull();
    });

    it('should return the next rep in rotation', async () => {
      const reps = ['rep-b', 'rep-a'];

      const first = await service.getNextRep(TENANT_ID, reps);
      expect(first).toBe('rep-a'); // sorted: rep-a first

      const second = await service.getNextRep(TENANT_ID, reps);
      expect(second).toBe('rep-b');

      const third = await service.getNextRep(TENANT_ID, reps);
      expect(third).toBe('rep-a'); // wraps around
    });
  });
});
