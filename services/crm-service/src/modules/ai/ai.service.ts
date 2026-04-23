import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../providers/redis.provider';
import { BedrockProvider } from './bedrock.provider';

/** Clamp a number to [0, 100]. */
export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * Compute a heuristic lead score based on available lead data.
 * Each factor contributes points: email +20, phone +20, company +15,
 * LINE ID +10, assigned +15, recent activity +20. Clamped to [0,100].
 */
export function computeLeadScoreHeuristic(lead: {
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  lineId?: string | null;
  assignedTo?: string | null;
  lastActivityAt?: Date | string | null;
}): { score: number; factors: Array<{ name: string; weight: number; value: number; description: string }> } {
  const factors: Array<{ name: string; weight: number; value: number; description: string }> = [];
  let raw = 0;

  const hasEmail = !!lead.email;
  factors.push({ name: 'Has Email', weight: 20, value: hasEmail ? 20 : 0, description: hasEmail ? 'Lead has email contact' : 'No email provided' });
  raw += hasEmail ? 20 : 0;

  const hasPhone = !!lead.phone;
  factors.push({ name: 'Has Phone', weight: 20, value: hasPhone ? 20 : 0, description: hasPhone ? 'Lead has phone contact' : 'No phone provided' });
  raw += hasPhone ? 20 : 0;

  const hasCompany = !!lead.companyName;
  factors.push({ name: 'Has Company', weight: 15, value: hasCompany ? 15 : 0, description: hasCompany ? 'Company name provided' : 'No company name' });
  raw += hasCompany ? 15 : 0;

  const hasLine = !!lead.lineId;
  factors.push({ name: 'Has LINE', weight: 10, value: hasLine ? 10 : 0, description: hasLine ? 'LINE ID provided' : 'No LINE ID' });
  raw += hasLine ? 10 : 0;

  const isAssigned = !!lead.assignedTo;
  factors.push({ name: 'Is Assigned', weight: 15, value: isAssigned ? 15 : 0, description: isAssigned ? 'Lead is assigned to a rep' : 'Unassigned lead' });
  raw += isAssigned ? 15 : 0;

  let recentActivity = false;
  if (lead.lastActivityAt) {
    const actDate = typeof lead.lastActivityAt === 'string' ? new Date(lead.lastActivityAt) : lead.lastActivityAt;
    const daysSince = (Date.now() - actDate.getTime()) / (1000 * 60 * 60 * 24);
    recentActivity = daysSince <= 7;
  }
  factors.push({ name: 'Recent Activity', weight: 20, value: recentActivity ? 20 : 0, description: recentActivity ? 'Activity within last 7 days' : 'No recent activity' });
  raw += recentActivity ? 20 : 0;

  return { score: clampScore(raw), factors };
}

/**
 * Compute close probability from stage probability + adjustments.
 * Base = stageProbability, then adjust for deal age and value.
 * Clamped to [0,100].
 */
export function computeCloseProbabilityHeuristic(opp: {
  stageProbability: number;
  expectedCloseDate?: Date | string | null;
  estimatedValue?: number | null;
  assignedTo?: string | null;
}): { probability: number; factors: Array<{ name: string; weight: number; value: number; description: string }> } {
  const factors: Array<{ name: string; weight: number; value: number; description: string }> = [];
  let base = typeof opp.stageProbability === 'number' ? opp.stageProbability : 50;

  factors.push({ name: 'Stage Probability', weight: 60, value: clampScore(base), description: `Base probability from pipeline stage: ${base}%` });

  // Adjust for deal age — if past expected close date, reduce probability
  let ageAdj = 0;
  if (opp.expectedCloseDate) {
    const closeDate = typeof opp.expectedCloseDate === 'string' ? new Date(opp.expectedCloseDate) : opp.expectedCloseDate;
    const daysUntilClose = (closeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntilClose < 0) {
      ageAdj = -10; // overdue deal
    } else if (daysUntilClose <= 7) {
      ageAdj = 5; // closing soon
    }
  }
  factors.push({ name: 'Deal Timing', weight: 20, value: clampScore(50 + ageAdj), description: ageAdj < 0 ? 'Deal is past expected close date' : ageAdj > 0 ? 'Deal closing within 7 days' : 'Normal timeline' });
  base += ageAdj;

  // Adjust for assignment
  const assignAdj = opp.assignedTo ? 5 : -5;
  factors.push({ name: 'Assignment', weight: 10, value: clampScore(50 + assignAdj), description: opp.assignedTo ? 'Deal has assigned owner' : 'No owner assigned' });
  base += assignAdj;

  // Adjust for deal value — higher value deals tend to have longer cycles
  let valueAdj = 0;
  if (opp.estimatedValue != null && opp.estimatedValue > 1000000) {
    valueAdj = -5; // large deals are harder to close
  }
  factors.push({ name: 'Deal Size', weight: 10, value: clampScore(50 + valueAdj), description: valueAdj < 0 ? 'Large deal (>1M THB) — longer cycle' : 'Standard deal size' });
  base += valueAdj;

  return { probability: clampScore(base), factors };
}

const CHAT_TTL_SECONDS = 1800; // 30 minutes

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly bedrock: BedrockProvider,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ── Meeting Summarization ──────────────────────────────────────────

  async summarize(
    meetingNotes: string,
    language: 'th' | 'en',
  ): Promise<{
    keyPoints: string[];
    actionItems: string[];
    nextSteps: string[];
    generatedAt: Date;
  }> {
    const systemPrompt =
      language === 'th'
        ? 'คุณเป็นผู้ช่วย AI สำหรับ CRM ที่ช่วยสรุปการประชุม ตอบเป็นภาษาไทยเท่านั้น ตอบเป็น JSON เท่านั้น'
        : 'You are a CRM AI assistant that summarizes meetings. Respond in English only. Respond in JSON only.';

    const prompt = `Summarize the following meeting notes into a structured JSON object with three arrays: "keyPoints", "actionItems", and "nextSteps". Each array should contain strings.\n\nMeeting notes:\n${meetingNotes}\n\nRespond with valid JSON only, no markdown.`;

    try {
      const raw = await this.bedrock.callBedrock(prompt, systemPrompt);
      return { ...this.parseSummaryJson(raw), generatedAt: new Date() };
    } catch (error) {
      this.logger.warn('Bedrock unavailable for summarize, returning fallback', (error as Error).message);
      return { keyPoints: [], actionItems: [], nextSteps: [], generatedAt: new Date() };
    }
  }

  private parseSummaryJson(raw: string): {
    keyPoints: string[];
    actionItems: string[];
    nextSteps: string[];
  } {
    try {
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
      };
    } catch {
      this.logger.warn('Failed to parse summary JSON, returning empty arrays');
      return { keyPoints: [], actionItems: [], nextSteps: [] };
    }
  }

  // ── Email Reply Suggestion ─────────────────────────────────────────

  async emailReply(
    emailThread: string,
    customerHistory?: string,
    language: 'th' | 'en' = 'en',
  ): Promise<{ reply: string; generatedAt: Date }> {
    const systemPrompt =
      language === 'th'
        ? 'คุณเป็นผู้ช่วย AI สำหรับ CRM ที่ช่วยร่างอีเมลตอบกลับ ตอบเป็นภาษาไทย'
        : 'You are a CRM AI assistant that drafts professional email replies.';

    let prompt = `Draft a professional reply to the following email thread:\n\n${emailThread}`;
    if (customerHistory) {
      prompt += `\n\nCustomer history context:\n${customerHistory}`;
    }
    prompt += '\n\nProvide only the reply text, no subject line.';

    try {
      const reply = await this.bedrock.callBedrock(prompt, systemPrompt);
      return { reply: reply.trim(), generatedAt: new Date() };
    } catch (error) {
      this.logger.warn('Bedrock unavailable for emailReply, returning fallback', (error as Error).message);
      return { reply: '', generatedAt: new Date() };
    }
  }

  // ── Lead Scoring (Heuristic) ───────────────────────────────────────

  async getLeadScore(
    leadId: string,
    leadData?: {
      email?: string | null;
      phone?: string | null;
      companyName?: string | null;
      lineId?: string | null;
      assignedTo?: string | null;
      lastActivityAt?: Date | string | null;
    },
  ): Promise<{
    leadId: string;
    score: number;
    factors: Array<{ name: string; weight: number; value: number; description: string }>;
    calculatedAt: Date;
  }> {
    // Use heuristic scoring — no Bedrock call needed
    const data = leadData || {};
    const { score, factors } = computeLeadScoreHeuristic(data);

    return {
      leadId,
      score,
      factors,
      calculatedAt: new Date(),
    };
  }

  // ── Close Probability (Heuristic) ──────────────────────────────────

  async getCloseProbability(
    oppId: string,
    oppData?: {
      stageProbability?: number;
      expectedCloseDate?: Date | string | null;
      estimatedValue?: number | null;
      assignedTo?: string | null;
    },
  ): Promise<{
    opportunityId: string;
    probability: number;
    factors: Array<{ name: string; weight: number; value: number; description: string }>;
    calculatedAt: Date;
  }> {
    // Use heuristic probability — no Bedrock call needed
    const data = {
      stageProbability: oppData?.stageProbability ?? 50,
      expectedCloseDate: oppData?.expectedCloseDate,
      estimatedValue: oppData?.estimatedValue,
      assignedTo: oppData?.assignedTo,
    };
    const { probability, factors } = computeCloseProbabilityHeuristic(data);

    return {
      opportunityId: oppId,
      probability,
      factors,
      calculatedAt: new Date(),
    };
  }

  // ── Thai Chatbot ───────────────────────────────────────────────────

  async chat(
    tenantId: string,
    userId: string,
    sessionId: string,
    message: string,
  ): Promise<{
    sessionId: string;
    reply: string;
    messages: Array<{ role: string; content: string; timestamp: Date }>;
  }> {
    const redisKey = `chat:${sessionId}`;

    // Load existing conversation from Redis
    const existing = await this.redis.get(redisKey);
    const messages: Array<{ role: string; content: string; timestamp: Date }> =
      existing ? JSON.parse(existing) : [];

    // Add user message
    messages.push({ role: 'user', content: message, timestamp: new Date() });

    const systemPrompt =
      `คุณเป็นผู้ช่วย AI สำหรับระบบ CRM ภาษาไทย (tenant: ${tenantId}, user: ${userId}) ` +
      'ตอบคำถามเกี่ยวกับลูกค้า ลีด โอกาสการขาย และข้อมูล CRM ' +
      'ตอบเป็นภาษาไทยเป็นหลัก แต่สามารถตอบเป็นภาษาอังกฤษได้หากผู้ใช้ถามเป็นภาษาอังกฤษ';

    // Build Bedrock messages (role + content only)
    const bedrockMessages = messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    let reply: string;
    try {
      reply = await this.bedrock.callBedrockWithHistory(bedrockMessages, systemPrompt);
    } catch (error) {
      this.logger.warn('Bedrock unavailable for chat, returning fallback', (error as Error).message);
      reply = 'ขออภัย ระบบ AI ไม่สามารถตอบได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง';
    }

    // Add assistant reply
    messages.push({ role: 'assistant', content: reply, timestamp: new Date() });

    // Store back in Redis with 30-minute TTL
    await this.redis.set(redisKey, JSON.stringify(messages), 'EX', CHAT_TTL_SECONDS);

    return { sessionId, reply, messages };
  }

  // ── Natural Language Search ────────────────────────────────────────

  async nlSearch(
    tenantId: string,
    query: string,
  ): Promise<{
    query: string;
    interpretation: string;
    results: Array<{ entityType: string; entityId: string; title: string; score: number }>;
    generatedAt: Date;
  }> {
    const systemPrompt =
      'You are a CRM search assistant. Interpret the user\'s natural language query and return a JSON object with "interpretation" (string explaining what the user is looking for) and "results" array. Each result has "entityType" (account|contact|lead|opportunity), "entityId" (placeholder UUID), "title", and "score" (0-100 relevance). Respond with valid JSON only, no markdown.';

    const prompt = `Interpret this CRM search query and suggest results:\n\nQuery: "${query}"\nTenant: ${tenantId}\n\nReturn JSON with "interpretation" and "results".`;

    try {
      const raw = await this.bedrock.callBedrock(prompt, systemPrompt);
      const parsed = this.parseSearchJson(raw);
      return { query, interpretation: parsed.interpretation, results: parsed.results, generatedAt: new Date() };
    } catch (error) {
      this.logger.warn('Bedrock unavailable for nlSearch, returning fallback', (error as Error).message);
      return { query, interpretation: '', results: [], generatedAt: new Date() };
    }
  }

  private parseSearchJson(raw: string): {
    interpretation: string;
    results: Array<{ entityType: string; entityId: string; title: string; score: number }>;
  } {
    try {
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        interpretation: parsed.interpretation || '',
        results: Array.isArray(parsed.results) ? parsed.results : [],
      };
    } catch {
      this.logger.warn('Failed to parse NL search JSON');
      return { interpretation: '', results: [] };
    }
  }

  // ── Next Best Action ───────────────────────────────────────────────

  async getNextAction(
    oppId: string,
  ): Promise<{
    opportunityId: string;
    suggestions: Array<{ action: string; reason: string; priority: string }>;
    generatedAt: Date;
  }> {
    const systemPrompt =
      'You are a CRM AI sales advisor. Suggest next-best-actions for a sales opportunity. Return a JSON object with "suggestions" array. Each suggestion has "action" (e.g., "Follow up", "Send proposal", "Schedule meeting"), "reason" (why this action), and "priority" ("high"|"medium"|"low"). Respond with valid JSON only, no markdown.';

    const prompt = `Suggest next-best-actions for opportunity ID "${oppId}". Return JSON with "suggestions".`;

    try {
      const raw = await this.bedrock.callBedrock(prompt, systemPrompt);
      const parsed = this.parseNextActionJson(raw);
      return { opportunityId: oppId, suggestions: parsed.suggestions, generatedAt: new Date() };
    } catch (error) {
      this.logger.warn('Bedrock unavailable for nextAction, returning fallback', (error as Error).message);
      return { opportunityId: oppId, suggestions: [], generatedAt: new Date() };
    }
  }

  private parseNextActionJson(raw: string): {
    suggestions: Array<{ action: string; reason: string; priority: string }>;
  } {
    try {
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    } catch {
      this.logger.warn('Failed to parse next action JSON');
      return { suggestions: [] };
    }
  }
}
