/**
 * Event bus types and queue configuration for inter-service communication.
 */

/**
 * SQS queue names used for inter-service communication.
 */
export const SQS_QUEUES = {
  CRM_EVENTS: 'crm-events',
  SALES_EVENTS: 'sales-events',
  QUOTATION_EVENTS: 'quotation-events',
  NOTIFICATION_EVENTS: 'notification-events',
} as const;

export type SqsQueueName = (typeof SQS_QUEUES)[keyof typeof SQS_QUEUES];

/**
 * Well-known domain event types published across services.
 */
export const EVENT_TYPES = {
  // CRM events
  ACCOUNT_CREATED: 'account.created',
  ACCOUNT_UPDATED: 'account.updated',
  ACCOUNT_DELETED: 'account.deleted',
  CONTACT_CREATED: 'contact.created',
  CONTACT_UPDATED: 'contact.updated',
  NOTE_CREATED: 'note.created',
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_OVERDUE: 'task.overdue',

  // Sales events
  LEAD_CREATED: 'lead.created',
  LEAD_UPDATED: 'lead.updated',
  LEAD_ASSIGNED: 'lead.assigned',
  LEAD_STATUS_CHANGED: 'lead.status_changed',
  OPPORTUNITY_CREATED: 'opportunity.created',
  OPPORTUNITY_UPDATED: 'opportunity.updated',
  OPPORTUNITY_STAGE_CHANGED: 'opportunity.stage_changed',
  OPPORTUNITY_CLOSED: 'opportunity.closed',

  // Quotation events
  QUOTATION_CREATED: 'quotation.created',
  QUOTATION_FINALIZED: 'quotation.finalized',
  QUOTATION_SENT: 'quotation.sent',
  QUOTATION_STATUS_CHANGED: 'quotation.status_changed',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
