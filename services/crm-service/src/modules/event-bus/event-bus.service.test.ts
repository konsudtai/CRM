import { EventBusService } from './event-bus.service';

// Mock @aws-sdk/client-sqs
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  SendMessageCommand: jest.fn().mockImplementation((input) => input),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: () => 'test-event-id-1234',
}));

describe('EventBusService', () => {
  let service: EventBusService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({ MessageId: 'sqs-msg-001' });
    service = new EventBusService();
  });

  it('should publish a DomainEvent with correct envelope fields', async () => {
    const event = await service.publish(
      'lead.assigned',
      'tenant-1',
      'user-1',
      { leadId: 'lead-123', assignedTo: 'user-2' },
    );

    expect(event).toMatchObject({
      eventId: 'test-event-id-1234',
      eventType: 'lead.assigned',
      tenantId: 'tenant-1',
      userId: 'user-1',
      payload: { leadId: 'lead-123', assignedTo: 'user-2' },
      version: 1,
    });
    expect(event.timestamp).toBeDefined();
    expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);
  });

  it('should send the event to SQS with message attributes', async () => {
    await service.publish(
      'task.overdue',
      'tenant-2',
      'user-3',
      { taskId: 'task-456' },
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const sentCommand = mockSend.mock.calls[0][0];
    expect(sentCommand.MessageAttributes).toEqual({
      eventType: { DataType: 'String', StringValue: 'task.overdue' },
      tenantId: { DataType: 'String', StringValue: 'tenant-2' },
    });

    const body = JSON.parse(sentCommand.MessageBody);
    expect(body.eventType).toBe('task.overdue');
    expect(body.tenantId).toBe('tenant-2');
  });

  it('should use custom version when provided', async () => {
    const event = await service.publish(
      'account.created',
      'tenant-1',
      'user-1',
      { accountId: 'acc-1' },
      2,
    );

    expect(event.version).toBe(2);
  });

  it('should not throw when SQS send fails', async () => {
    mockSend.mockRejectedValue(new Error('SQS unavailable'));

    const event = await service.publish(
      'lead.created',
      'tenant-1',
      'user-1',
      { leadId: 'lead-789' },
    );

    // Should still return the event even if SQS fails
    expect(event.eventType).toBe('lead.created');
    expect(event.eventId).toBe('test-event-id-1234');
  });
});
