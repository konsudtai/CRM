/**
 * Common domain interfaces shared across all services.
 */

export interface DomainEvent {
  eventId: string; // UUID v4
  eventType: string; // e.g., "lead.created", "deal.stage_changed"
  tenantId: string;
  userId: string;
  timestamp: string; // ISO 8601
  payload: Record<string, unknown>;
  version: number; // Schema version
}

export interface ErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
  details?: Record<string, unknown>;
}
