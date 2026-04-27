import { EventConsumerService } from './event-consumer.service';
import { DomainEvent, EVENT_TYPES } from '@thai-smb-crm/shared-types';
import { Message } from '@aws-sdk/client-sqs';

describe('EventConsumerService', () => {
  let service: EventConsumerService;
  let mockSqsProvider: any;
  let mockNotificationsService: any;
  let mockWebhooksService: any;

  beforeEach(() => {
    mockSqsProvider = {
      registerHandler: jest.fn(),
    };
    mockNotificationsService = {
      send: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };
    mockWebhooksService = {
      fireEvent: jest.fn().mockResolvedValue(undefined),
    };

    service = new EventConsumerService(
      mockSqsProvider,
      mockNotificationsService,
      mockWebhooksService,
    );
  });

  it('should register handler with SQS provider on init', () => {
    service.onModuleInit();
    expect(mockSqsProvider.registerHandler).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });

  it('should skip messages with empty body', async () => {
    const message: Message = { Body: undefined };
    await service.handleMessage(message);
    expect(mockNotificationsService.send).not.toHaveBeenCalled();
    expect(mockWebhooksService.fireEvent).not.toHaveBeenCalled();
  });

  it('should skip messages with invalid JSON', async () => {
    const message: Message = { Body: 'not-json' };
    await service.handleMessage(message);
    expect(mockNotificationsService.send).not.toHaveBeenCalled();
    expect(mockWebhooksService.fireEvent).not.toHaveBeenCalled();
  });

  it('should dispatch LINE notification for lead.assigned events', async () => {
    const event: DomainEvent = {
      eventId: 'evt-1',
      eventType: EVENT_TYPES.LEAD_ASSIGNED,
      tenantId: 'tenant-1',
      userId: 'user-1',
      timestamp: new Date().toISOString(),
      payload: { leadId: 'lead-1', leadName: 'Acme Corp', assignedTo: 'user-2' },
      version: 1,
    };
    const message: Message = { Body: JSON.stringify(event) };

    await service.handleMessage(message);

    expect(mockNotificationsService.send).toHaveBeenCalledWith(
      'tenant-1',
      'user-2',
      'line',
      'lead_assigned',
      'New Lead Assigned',
      'Lead "Acme Corp" has been assigned to you.',
      expect.objectContaining({ leadId: 'lead-1', eventId: 'evt-1' }),
    );
  });

  it('should dispatch LINE notification for task.overdue events', async () => {
    const event: DomainEvent = {
      eventId: 'evt-2',
      eventType: EVENT_TYPES.TASK_OVERDUE,
      tenantId: 'tenant-1',
      userId: 'user-1',
      timestamp: new Date().toISOString(),
      payload: { taskId: 'task-1', title: 'Follow up call', assignedTo: 'user-3' },
      version: 1,
    };
    const message: Message = { Body: JSON.stringify(event) };

    await service.handleMessage(message);

    expect(mockNotificationsService.send).toHaveBeenCalledWith(
      'tenant-1',
      'user-3',
      'line',
      'task_overdue',
      'Task Overdue',
      'Task "Follow up call" is past its due date.',
      expect.objectContaining({ taskId: 'task-1', eventId: 'evt-2' }),
    );
  });

  it('should dispatch in-app notification for deal stage change events', async () => {
    const event: DomainEvent = {
      eventId: 'evt-3',
      eventType: EVENT_TYPES.OPPORTUNITY_STAGE_CHANGED,
      tenantId: 'tenant-1',
      userId: 'user-1',
      timestamp: new Date().toISOString(),
      payload: {
        opportunityId: 'opp-1',
        dealName: 'Big Deal',
        newStage: 'Negotiation',
        assignedTo: 'user-4',
      },
      version: 1,
    };
    const message: Message = { Body: JSON.stringify(event) };

    await service.handleMessage(message);

    expect(mockNotificationsService.send).toHaveBeenCalledWith(
      'tenant-1',
      'user-4',
      'in_app',
      'deal_stage_changed',
      'Deal Stage Changed',
      'Deal "Big Deal" moved to stage "Negotiation".',
      expect.objectContaining({ opportunityId: 'opp-1', eventId: 'evt-3' }),
    );
  });

  it('should always fire webhook events for all domain events', async () => {
    const event: DomainEvent = {
      eventId: 'evt-4',
      eventType: EVENT_TYPES.ACCOUNT_CREATED,
      tenantId: 'tenant-1',
      userId: 'user-1',
      timestamp: new Date().toISOString(),
      payload: { accountId: 'acc-1' },
      version: 1,
    };
    const message: Message = { Body: JSON.stringify(event) };

    await service.handleMessage(message);

    expect(mockWebhooksService.fireEvent).toHaveBeenCalledWith(
      'tenant-1',
      'account',
      'account.created',
      expect.objectContaining({
        accountId: 'acc-1',
        eventId: 'evt-4',
        userId: 'user-1',
      }),
    );
  });

  it('should not throw when notification dispatch fails', async () => {
    mockNotificationsService.send.mockRejectedValue(new Error('LINE API down'));

    const event: DomainEvent = {
      eventId: 'evt-5',
      eventType: EVENT_TYPES.LEAD_ASSIGNED,
      tenantId: 'tenant-1',
      userId: 'user-1',
      timestamp: new Date().toISOString(),
      payload: { leadId: 'lead-1', assignedTo: 'user-2' },
      version: 1,
    };
    const message: Message = { Body: JSON.stringify(event) };

    // Should not throw
    await expect(service.handleMessage(message)).resolves.not.toThrow();
    // Webhook should still be called
    expect(mockWebhooksService.fireEvent).toHaveBeenCalled();
  });
});
