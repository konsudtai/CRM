/**
 * Notification and webhook interfaces.
 */

export interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  channel: 'line' | 'email' | 'in_app';
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  retryCount: number;
  sentAt?: Date;
  createdAt: Date;
}

export interface WebhookConfig {
  id: string;
  tenantId: string;
  url: string;
  secret: string;
  eventTypes: string[];
  entityTypes: string[];
  isActive: boolean;
  createdAt: Date;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  payload: Record<string, unknown>;
  responseStatus?: number;
  responseBody?: string;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  nextRetryAt?: Date;
  createdAt: Date;
}
