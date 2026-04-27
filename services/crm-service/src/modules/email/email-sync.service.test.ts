import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { EmailSyncService, SyncResult } from './email-sync.service';
import { EmailSync } from '../../entities/email-sync.entity';
import { Contact } from '../../entities/contact.entity';
import { Activity } from '../../entities/activity.entity';
import { GmailService } from './gmail.service';
import { OutlookService } from './outlook.service';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000099';

function makeSync(overrides: Partial<EmailSync> = {}): EmailSync {
  return {
    id: '00000000-0000-0000-0000-000000000050',
    tenantId: TENANT_ID,
    userId: USER_ID,
    provider: 'gmail',
    status: 'connected',
    accessToken: 'valid-access-token',
    refreshToken: 'valid-refresh-token',
    tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
    lastSyncAt: null,
    lastError: null,
    consecutiveFailures: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as EmailSync;
}

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: '00000000-0000-0000-0000-000000000060',
    tenantId: TENANT_ID,
    accountId: '00000000-0000-0000-0000-000000000070',
    firstName: 'Test',
    lastName: 'Contact',
    title: null,
    phone: null,
    email: 'test@example.com',
    lineId: null,
    customFields: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    account: {} as any,
    ...overrides,
  } as Contact;
}

describe('EmailSyncService', () => {
  let service: EmailSyncService;
  let emailSyncRepo: Record<string, jest.Mock>;
  let contactRepo: Record<string, jest.Mock>;
  let activityRepo: Record<string, jest.Mock>;
  let gmailService: Record<string, jest.Mock>;
  let outlookService: Record<string, jest.Mock>;

  beforeEach(async () => {
    emailSyncRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) => Promise.resolve({ ...makeSync(), ...entity })),
    };

    contactRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    activityRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ id: 'new-activity-id', ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    gmailService = {
      listMessages: jest.fn().mockResolvedValue([]),
      refreshAccessToken: jest.fn(),
    };

    outlookService = {
      listMessages: jest.fn().mockResolvedValue([]),
      refreshAccessToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailSyncService,
        { provide: getRepositoryToken(EmailSync), useValue: emailSyncRepo },
        { provide: getRepositoryToken(Contact), useValue: contactRepo },
        { provide: getRepositoryToken(Activity), useValue: activityRepo },
        { provide: GmailService, useValue: gmailService },
        { provide: OutlookService, useValue: outlookService },
      ],
    }).compile();

    service = module.get(EmailSyncService);
    // Override sleep to avoid delays in tests
    (service as any).sleep = jest.fn().mockResolvedValue(undefined);
  });

  describe('getOrCreateSync', () => {
    it('should return existing sync record', async () => {
      const existing = makeSync();
      emailSyncRepo.findOne.mockResolvedValue(existing);

      const result = await service.getOrCreateSync(TENANT_ID, USER_ID, 'gmail');
      expect(result).toEqual(existing);
    });

    it('should create new sync record if none exists', async () => {
      emailSyncRepo.findOne.mockResolvedValue(null);

      const result = await service.getOrCreateSync(TENANT_ID, USER_ID, 'gmail');
      expect(emailSyncRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          userId: USER_ID,
          provider: 'gmail',
          status: 'disconnected',
        }),
      );
      expect(emailSyncRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('storeTokens', () => {
    it('should update sync record with tokens', async () => {
      const sync = makeSync();
      emailSyncRepo.findOne.mockResolvedValue(sync);

      const expiresAt = new Date(Date.now() + 3600 * 1000);
      const result = await service.storeTokens(sync.id, 'new-access', 'new-refresh', expiresAt);

      expect(emailSyncRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
          tokenExpiresAt: expiresAt,
          status: 'connected',
          consecutiveFailures: 0,
        }),
      );
    });

    it('should throw NotFoundException if sync not found', async () => {
      emailSyncRepo.findOne.mockResolvedValue(null);
      await expect(
        service.storeTokens('nonexistent', 'a', 'b', new Date()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should return base_delay * 2^attempt', () => {
      expect(service.calculateBackoffDelay(0, 1000)).toBe(1000);
      expect(service.calculateBackoffDelay(1, 1000)).toBe(2000);
      expect(service.calculateBackoffDelay(2, 1000)).toBe(4000);
    });
  });

  describe('extractEmailAddresses', () => {
    it('should extract email from "Name <email>" format', () => {
      const result = service.extractEmailAddresses(['John Doe <john@example.com>']);
      expect(result).toEqual(['john@example.com']);
    });

    it('should handle plain email addresses', () => {
      const result = service.extractEmailAddresses(['jane@example.com']);
      expect(result).toEqual(['jane@example.com']);
    });

    it('should deduplicate emails', () => {
      const result = service.extractEmailAddresses([
        'john@example.com',
        'John <john@example.com>',
      ]);
      expect(result).toEqual(['john@example.com']);
    });

    it('should skip empty/null values', () => {
      const result = service.extractEmailAddresses(['', null as any, 'a@b.com']);
      expect(result).toEqual(['a@b.com']);
    });

    it('should lowercase all emails', () => {
      const result = service.extractEmailAddresses(['John@EXAMPLE.COM']);
      expect(result).toEqual(['john@example.com']);
    });
  });

  describe('syncWithRetry', () => {
    it('should succeed on first attempt when sync works', async () => {
      const sync = makeSync();
      gmailService.listMessages.mockResolvedValue([]);

      const result = await service.syncWithRetry(sync);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.emailsSynced).toBe(0);
    });

    it('should retry up to 3 times on failure', async () => {
      const sync = makeSync();
      gmailService.listMessages
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await service.syncWithRetry(sync);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(result.error).toBe('Network error');
    });

    it('should succeed on second attempt after first failure', async () => {
      const sync = makeSync();
      gmailService.listMessages
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce([]);

      const result = await service.syncWithRetry(sync);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('should mark sync as error after all retries exhausted', async () => {
      const sync = makeSync();
      gmailService.listMessages.mockRejectedValue(new Error('Persistent error'));

      await service.syncWithRetry(sync);

      expect(emailSyncRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          lastError: 'Persistent error',
        }),
      );
    });

    it('should link Gmail messages to contacts and create timeline entries', async () => {
      const sync = makeSync();
      const contact = makeContact();

      gmailService.listMessages.mockResolvedValue([
        {
          messageId: 'msg-1',
          threadId: 'thread-1',
          from: 'test@example.com',
          to: ['user@company.com'],
          subject: 'Hello',
          snippet: 'Hi there',
          date: new Date('2025-06-15T10:00:00Z'),
          labelIds: ['INBOX'],
        },
      ]);

      contactRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([contact]),
      });

      const result = await service.syncWithRetry(sync);

      expect(result.success).toBe(true);
      expect(result.emailsSynced).toBe(1);
      expect(result.emailsLinked).toBe(1);
      expect(activityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          entityType: 'email',
          entityId: contact.id,
          summary: 'Email: Hello',
          metadata: expect.objectContaining({
            provider: 'gmail',
            messageId: 'msg-1',
            subject: 'Hello',
          }),
        }),
      );
    });

    it('should link Outlook messages to contacts', async () => {
      const sync = makeSync({ provider: 'outlook' });
      const contact = makeContact();

      outlookService.listMessages.mockResolvedValue([
        {
          messageId: 'outlook-msg-1',
          conversationId: 'conv-1',
          from: 'test@example.com',
          toRecipients: ['user@company.com'],
          subject: 'Meeting',
          bodyPreview: 'Let us meet',
          receivedDateTime: new Date('2025-06-15T10:00:00Z'),
        },
      ]);

      contactRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([contact]),
      });

      const result = await service.syncWithRetry(sync);

      expect(result.success).toBe(true);
      expect(result.emailsSynced).toBe(1);
      expect(result.emailsLinked).toBe(1);
      expect(activityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'email',
          metadata: expect.objectContaining({
            provider: 'outlook',
            messageId: 'outlook-msg-1',
          }),
        }),
      );
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync records for user', async () => {
      const syncs = [makeSync(), makeSync({ provider: 'outlook' })];
      emailSyncRepo.find.mockResolvedValue(syncs);

      const result = await service.getSyncStatus(TENANT_ID, USER_ID);
      expect(result).toHaveLength(2);
    });
  });

  describe('findContactsByEmails', () => {
    it('should return empty array for empty email list', async () => {
      const result = await service.findContactsByEmails(TENANT_ID, []);
      expect(result).toEqual([]);
    });
  });
});
