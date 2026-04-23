import { Test, TestingModule } from '@nestjs/testing';
import {
  AiService,
  clampScore,
  computeLeadScoreHeuristic,
  computeCloseProbabilityHeuristic,
} from './ai.service';
import { BedrockProvider } from './bedrock.provider';
import { REDIS_CLIENT } from '../../providers/redis.provider';

// ── clampScore ───────────────────────────────────────────────────────

describe('clampScore', () => {
  it('returns 0 for negative values', () => {
    expect(clampScore(-10)).toBe(0);
    expect(clampScore(-1)).toBe(0);
  });

  it('returns 100 for values above 100', () => {
    expect(clampScore(150)).toBe(100);
    expect(clampScore(101)).toBe(100);
  });

  it('returns the value when within [0, 100]', () => {
    expect(clampScore(0)).toBe(0);
    expect(clampScore(50)).toBe(50);
    expect(clampScore(100)).toBe(100);
    expect(clampScore(73.5)).toBe(73.5);
  });

  it('returns 0 for NaN and Infinity', () => {
    expect(clampScore(NaN)).toBe(0);
    expect(clampScore(Infinity)).toBe(0);
    expect(clampScore(-Infinity)).toBe(0);
  });
});

// ── computeLeadScoreHeuristic ────────────────────────────────────────

describe('computeLeadScoreHeuristic', () => {
  it('returns 0 for empty lead data', () => {
    const result = computeLeadScoreHeuristic({});
    expect(result.score).toBe(0);
    expect(result.factors).toHaveLength(6);
  });

  it('adds 20 for email', () => {
    const result = computeLeadScoreHeuristic({ email: 'test@example.com' });
    expect(result.score).toBe(20);
  });

  it('adds 20 for phone', () => {
    const result = computeLeadScoreHeuristic({ phone: '0812345678' });
    expect(result.score).toBe(20);
  });

  it('adds 15 for company name', () => {
    const result = computeLeadScoreHeuristic({ companyName: 'Acme Corp' });
    expect(result.score).toBe(15);
  });

  it('adds 10 for LINE ID', () => {
    const result = computeLeadScoreHeuristic({ lineId: '@acme' });
    expect(result.score).toBe(10);
  });

  it('adds 15 for assigned rep', () => {
    const result = computeLeadScoreHeuristic({ assignedTo: 'user-1' });
    expect(result.score).toBe(15);
  });

  it('adds 20 for recent activity (within 7 days)', () => {
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const result = computeLeadScoreHeuristic({ lastActivityAt: recent });
    expect(result.score).toBe(20);
  });

  it('does not add activity points for old activity', () => {
    const old = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 days ago
    const result = computeLeadScoreHeuristic({ lastActivityAt: old });
    expect(result.score).toBe(0);
  });

  it('returns max 100 for a fully-populated lead', () => {
    const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const result = computeLeadScoreHeuristic({
      email: 'a@b.com',
      phone: '123',
      companyName: 'Co',
      lineId: '@co',
      assignedTo: 'rep',
      lastActivityAt: recent,
    });
    expect(result.score).toBe(100);
  });

  it('clamps score to [0, 100]', () => {
    const result = computeLeadScoreHeuristic({});
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ── computeCloseProbabilityHeuristic ─────────────────────────────────

describe('computeCloseProbabilityHeuristic', () => {
  it('uses stage probability as base', () => {
    const result = computeCloseProbabilityHeuristic({ stageProbability: 60 });
    // 60 base - 5 (no assignment) = 55
    expect(result.probability).toBe(55);
  });

  it('reduces probability for overdue deals', () => {
    const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const result = computeCloseProbabilityHeuristic({
      stageProbability: 70,
      expectedCloseDate: pastDate,
      assignedTo: 'rep-1',
    });
    // 70 - 10 (overdue) + 5 (assigned) = 65
    expect(result.probability).toBe(65);
  });

  it('boosts probability for deals closing soon', () => {
    const soonDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const result = computeCloseProbabilityHeuristic({
      stageProbability: 50,
      expectedCloseDate: soonDate,
      assignedTo: 'rep-1',
    });
    // 50 + 5 (soon) + 5 (assigned) = 60
    expect(result.probability).toBe(60);
  });

  it('reduces probability for large deals', () => {
    const result = computeCloseProbabilityHeuristic({
      stageProbability: 80,
      estimatedValue: 2000000,
      assignedTo: 'rep-1',
    });
    // 80 + 5 (assigned) - 5 (large deal) = 80
    expect(result.probability).toBe(80);
  });

  it('clamps to 0 for very low base', () => {
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = computeCloseProbabilityHeuristic({
      stageProbability: 5,
      expectedCloseDate: pastDate,
      estimatedValue: 5000000,
    });
    // 5 - 10 (overdue) - 5 (unassigned) - 5 (large) = -15 → clamped to 0
    expect(result.probability).toBe(0);
  });

  it('clamps to 100 for very high base', () => {
    const soonDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const result = computeCloseProbabilityHeuristic({
      stageProbability: 98,
      expectedCloseDate: soonDate,
      assignedTo: 'rep-1',
    });
    // 98 + 5 (soon) + 5 (assigned) = 108 → clamped to 100
    expect(result.probability).toBe(100);
  });

  it('defaults to 50 when stageProbability is missing', () => {
    const result = computeCloseProbabilityHeuristic({
      stageProbability: undefined as any,
      assignedTo: 'rep-1',
    });
    // 50 + 5 (assigned) = 55
    expect(result.probability).toBe(55);
  });
});

// ── AiService (integration with mocked Bedrock) ─────────────────────

describe('AiService', () => {
  let service: AiService;
  let mockBedrock: { callBedrock: jest.Mock; callBedrockWithHistory: jest.Mock };
  let mockRedis: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    mockBedrock = {
      callBedrock: jest.fn(),
      callBedrockWithHistory: jest.fn(),
    };
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: BedrockProvider, useValue: mockBedrock },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  describe('summarize', () => {
    it('returns structured summary from Bedrock response', async () => {
      mockBedrock.callBedrock.mockResolvedValue(
        JSON.stringify({
          keyPoints: ['Point 1', 'Point 2'],
          actionItems: ['Action 1'],
          nextSteps: ['Step 1'],
        }),
      );

      const result = await service.summarize('Meeting notes here', 'en');

      expect(result.keyPoints).toEqual(['Point 1', 'Point 2']);
      expect(result.actionItems).toEqual(['Action 1']);
      expect(result.nextSteps).toEqual(['Step 1']);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('handles Thai language', async () => {
      mockBedrock.callBedrock.mockResolvedValue(
        JSON.stringify({
          keyPoints: ['ประเด็นสำคัญ'],
          actionItems: ['สิ่งที่ต้องทำ'],
          nextSteps: ['ขั้นตอนถัดไป'],
        }),
      );

      const result = await service.summarize('บันทึกการประชุม', 'th');

      expect(result.keyPoints).toEqual(['ประเด็นสำคัญ']);
      expect(mockBedrock.callBedrock).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('ภาษาไทย'),
      );
    });

    it('returns empty arrays on malformed JSON', async () => {
      mockBedrock.callBedrock.mockResolvedValue('not valid json');

      const result = await service.summarize('notes', 'en');

      expect(result.keyPoints).toEqual([]);
      expect(result.actionItems).toEqual([]);
      expect(result.nextSteps).toEqual([]);
    });

    it('returns fallback when Bedrock is unavailable', async () => {
      mockBedrock.callBedrock.mockRejectedValue(new Error('Service unavailable'));

      const result = await service.summarize('notes', 'en');

      expect(result.keyPoints).toEqual([]);
      expect(result.actionItems).toEqual([]);
      expect(result.nextSteps).toEqual([]);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });
  });

  describe('emailReply', () => {
    it('returns reply text from Bedrock', async () => {
      mockBedrock.callBedrock.mockResolvedValue('Thank you for your email.');

      const result = await service.emailReply('Email thread here');

      expect(result.reply).toBe('Thank you for your email.');
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('passes customer history when provided', async () => {
      mockBedrock.callBedrock.mockResolvedValue('Reply with context');

      await service.emailReply('Thread', 'History info', 'th');

      expect(mockBedrock.callBedrock).toHaveBeenCalledWith(
        expect.stringContaining('History info'),
        expect.stringContaining('ภาษาไทย'),
      );
    });

    it('returns fallback when Bedrock is unavailable', async () => {
      mockBedrock.callBedrock.mockRejectedValue(new Error('timeout'));

      const result = await service.emailReply('Thread');

      expect(result.reply).toBe('');
      expect(result.generatedAt).toBeInstanceOf(Date);
    });
  });

  describe('getLeadScore', () => {
    it('returns heuristic score with factors', async () => {
      const result = await service.getLeadScore('lead-123', {
        email: 'test@example.com',
        phone: '0812345678',
        companyName: 'Acme',
      });

      expect(result.leadId).toBe('lead-123');
      expect(result.score).toBe(55); // 20+20+15
      expect(result.factors).toHaveLength(6);
      expect(result.calculatedAt).toBeInstanceOf(Date);
    });

    it('returns 0 for empty lead data', async () => {
      const result = await service.getLeadScore('lead-empty');
      expect(result.score).toBe(0);
    });

    it('returns 100 for fully populated lead', async () => {
      const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const result = await service.getLeadScore('lead-full', {
        email: 'a@b.com',
        phone: '123',
        companyName: 'Co',
        lineId: '@co',
        assignedTo: 'rep',
        lastActivityAt: recent,
      });
      expect(result.score).toBe(100);
    });
  });

  describe('getCloseProbability', () => {
    it('returns heuristic probability', async () => {
      const result = await service.getCloseProbability('opp-123', {
        stageProbability: 60,
        assignedTo: 'rep-1',
      });

      expect(result.opportunityId).toBe('opp-123');
      expect(result.probability).toBe(65); // 60 + 5 (assigned)
      expect(result.factors).toHaveLength(4);
      expect(result.calculatedAt).toBeInstanceOf(Date);
    });

    it('clamps probability to [0, 100]', async () => {
      const result = await service.getCloseProbability('opp-low', {
        stageProbability: 0,
      });
      expect(result.probability).toBeGreaterThanOrEqual(0);
      expect(result.probability).toBeLessThanOrEqual(100);
    });
  });

  describe('chat', () => {
    it('creates new session when no existing messages', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockBedrock.callBedrockWithHistory.mockResolvedValue('สวัสดีครับ');

      const result = await service.chat('tenant-1', 'user-1', 'session-1', 'สวัสดี');

      expect(result.sessionId).toBe('session-1');
      expect(result.reply).toBe('สวัสดีครับ');
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[1].role).toBe('assistant');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'chat:session-1',
        expect.any(String),
        'EX',
        1800,
      );
    });

    it('appends to existing conversation', async () => {
      const existing = JSON.stringify([
        { role: 'user', content: 'Hello', timestamp: new Date() },
        { role: 'assistant', content: 'Hi there', timestamp: new Date() },
      ]);
      mockRedis.get.mockResolvedValue(existing);
      mockBedrock.callBedrockWithHistory.mockResolvedValue('Sure, I can help.');

      const result = await service.chat('t1', 'u1', 's1', 'Help me');

      expect(result.messages).toHaveLength(4);
      expect(mockBedrock.callBedrockWithHistory).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'Hello' }),
          expect.objectContaining({ role: 'assistant', content: 'Hi there' }),
          expect.objectContaining({ role: 'user', content: 'Help me' }),
        ]),
        expect.any(String),
      );
    });

    it('returns fallback when Bedrock is unavailable', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockBedrock.callBedrockWithHistory.mockRejectedValue(new Error('timeout'));

      const result = await service.chat('t1', 'u1', 's1', 'Hello');

      expect(result.reply).toContain('ขออภัย');
      expect(result.messages).toHaveLength(2);
    });
  });

  describe('nlSearch', () => {
    it('returns interpreted search results', async () => {
      mockBedrock.callBedrock.mockResolvedValue(
        JSON.stringify({
          interpretation: 'Looking for accounts in Bangkok',
          results: [
            { entityType: 'account', entityId: 'acc-1', title: 'Bangkok Corp', score: 95 },
          ],
        }),
      );

      const result = await service.nlSearch('tenant-1', 'บริษัทในกรุงเทพ');

      expect(result.query).toBe('บริษัทในกรุงเทพ');
      expect(result.interpretation).toBe('Looking for accounts in Bangkok');
      expect(result.results).toHaveLength(1);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('returns empty results on parse failure', async () => {
      mockBedrock.callBedrock.mockResolvedValue('invalid');

      const result = await service.nlSearch('tenant-1', 'query');

      expect(result.results).toEqual([]);
      expect(result.interpretation).toBe('');
    });

    it('returns fallback when Bedrock is unavailable', async () => {
      mockBedrock.callBedrock.mockRejectedValue(new Error('timeout'));

      const result = await service.nlSearch('tenant-1', 'query');

      expect(result.results).toEqual([]);
      expect(result.interpretation).toBe('');
    });
  });

  describe('getNextAction', () => {
    it('returns action suggestions', async () => {
      mockBedrock.callBedrock.mockResolvedValue(
        JSON.stringify({
          suggestions: [
            { action: 'Follow up', reason: 'No contact in 7 days', priority: 'high' },
            { action: 'Send proposal', reason: 'Lead is qualified', priority: 'medium' },
          ],
        }),
      );

      const result = await service.getNextAction('opp-123');

      expect(result.opportunityId).toBe('opp-123');
      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].action).toBe('Follow up');
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('returns empty suggestions on parse failure', async () => {
      mockBedrock.callBedrock.mockResolvedValue('bad json');

      const result = await service.getNextAction('opp-456');

      expect(result.suggestions).toEqual([]);
    });

    it('returns fallback when Bedrock is unavailable', async () => {
      mockBedrock.callBedrock.mockRejectedValue(new Error('timeout'));

      const result = await service.getNextAction('opp-789');

      expect(result.suggestions).toEqual([]);
    });
  });
});
