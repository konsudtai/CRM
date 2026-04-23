/**
 * AI service interfaces — Bedrock integration.
 */

export interface AISummaryRequest {
  meetingNotes: string;
  language: 'th' | 'en';
}

export interface AISummaryResponse {
  keyPoints: string[];
  actionItems: string[];
  nextSteps: string[];
  generatedAt: Date;
}

export interface ScoreFactor {
  name: string;
  weight: number;
  value: number;
  description: string;
}

export interface LeadScore {
  leadId: string;
  score: number;
  factors: ScoreFactor[];
  calculatedAt: Date;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  sessionId: string;
  tenantId: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: Date;
  lastActiveAt: Date;
}
