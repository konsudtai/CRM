import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CalendarSyncService, CalendarSyncResult } from './calendar-sync.service';
import { CalendarSync } from '../../entities/calendar-sync.entity';
import { Activity } from '../../entities/activity.entity';
import { GoogleCalendarService } from './google-calendar.service';
import { MicrosoftCalendarService } from './microsoft-calendar.service';

describe('CalendarSyncService', () => {
  let service: CalendarSyncService;
  let calendarSyncRepo: any;
  let activityRepo: any;
  let googleCalendarService: any;
  let microsoftCalendarService: any;

  const mockCalendarSyncRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockActivityRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockGoogleCalendarService = {
    listEvents: jest.fn(),
    refreshAccessToken: jest.fn(),
    exchangeCode: jest.fn(),
    getAuthUrl: jest.fn(),
  };

  const mockMicrosoftCalendarService = {
    listEvents: jest.fn(),
    refreshAccessToken: jest.fn(),
    exchangeCode: jest.fn(),
    getAuthUrl: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarSyncService,
        { provide: getRepositoryToken(CalendarSync), useValue: mockCalendarSyncRepo },
        { provide: getRepositoryToken(Activity), useValue: mockActivityRepo },
        { provide: GoogleCalendarService, useValue: mockGoogleCalendarService },
        { provide: MicrosoftCalendarService, useValue: mockMicrosoftCalendarService },
      ],
    }).compile();

    service = module.get<CalendarSyncService>(CalendarSyncService);
    calendarSyncRepo = mockCalendarSyncRepo;
    activityRepo = mockActivityRepo;
    googleCalendarService = mockGoogleCalendarService;
    microsoftCalendarService = mockMicrosoftCalendarService;
  });

  describe('getOrCreateSync', () => {
    it('should return existing sync record if found', async () => {
      const existing = { id: 'sync-1', tenantId: 't1', userId: 'u1', provider: 'google_calendar' };
      calendarSyncRepo.findOne.mockResolvedValue(existing);

      const result = await service.getOrCreateSync('t1', 'u1', 'google_calendar');
      expect(result).toEqual(existing);
      expect(calendarSyncRepo.create).not.toHaveBeenCalled();
    });

    it('should create a new sync record if none exists', async () => {
      calendarSyncRepo.findOne.mockResolvedValue(null);
      const created = { id: 'sync-new', tenantId: 't1', userId: 'u1', provider: 'microsoft_calendar', status: 'disconnected' };
      calendarSyncRepo.create.mockReturnValue(created);
      calendarSyncRepo.save.mockResolvedValue(created);

      const result = await service.getOrCreateSync('t1', 'u1', 'microsoft_calendar');
      expect(result).toEqual(created);
      expect(calendarSyncRepo.create).toHaveBeenCalledWith({
        tenantId: 't1',
        userId: 'u1',
        provider: 'microsoft_calendar',
        status: 'disconnected',
      });
    });
  });

  describe('storeTokens', () => {
    it('should store tokens and set status to connected', async () => {
      const sync = { id: 'sync-1', status: 'disconnected', consecutiveFailures: 2, lastError: 'old error' };
      calendarSyncRepo.findOne.mockResolvedValue(sync);
      calendarSyncRepo.save.mockResolvedValue(sync);

      const expiresAt = new Date(Date.now() + 3600000);
      const result = await service.storeTokens('sync-1', 'access-tok', 'refresh-tok', expiresAt);

      expect(result.accessToken).toBe('access-tok');
      expect(result.refreshToken).toBe('refresh-tok');
      expect(result.tokenExpiresAt).toBe(expiresAt);
      expect(result.status).toBe('connected');
      expect(result.consecutiveFailures).toBe(0);
      expect(result.lastError).toBeNull();
    });

    it('should throw NotFoundException if sync record not found', async () => {
      calendarSyncRepo.findOne.mockResolvedValue(null);
      await expect(
        service.storeTokens('nonexistent', 'a', 'r', new Date()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync records for the user', async () => {
      const syncs = [
        { id: 's1', provider: 'google_calendar', status: 'connected' },
        { id: 's2', provider: 'microsoft_calendar', status: 'disconnected' },
      ];
      calendarSyncRepo.find.mockResolvedValue(syncs);

      const result = await service.getSyncStatus('t1', 'u1');
      expect(result).toEqual(syncs);
      expect(calendarSyncRepo.find).toHaveBeenCalledWith({
        where: { tenantId: 't1', userId: 'u1' },
        select: ['id', 'provider', 'status', 'lastSyncAt', 'lastError', 'consecutiveFailures', 'calendarId', 'createdAt'],
      });
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff: base * 2^attempt', () => {
      expect(service.calculateBackoffDelay(0, 1000)).toBe(1000);
      expect(service.calculateBackoffDelay(1, 1000)).toBe(2000);
      expect(service.calculateBackoffDelay(2, 1000)).toBe(4000);
    });
  });

  describe('syncWithRetry', () => {
    const makeSync = (overrides: Partial<CalendarSync> = {}): CalendarSync => ({
      id: 'sync-1',
      tenantId: 't1',
      userId: 'u1',
      provider: 'google_calendar',
      status: 'connected',
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      tokenExpiresAt: new Date(Date.now() + 3600000),
      lastSyncAt: new Date(Date.now() - 60000),
      lastError: null,
      consecutiveFailures: 0,
      calendarId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as CalendarSync);

    it('should succeed on first attempt when sync works', async () => {
      const sync = makeSync();
      calendarSyncRepo.save.mockResolvedValue(sync);
      googleCalendarService.listEvents.mockResolvedValue([
        {
          eventId: 'evt-1',
          summary: 'Team Meeting',
          start: new Date(),
          end: new Date(),
          attendees: [],
          status: 'confirmed',
          updated: new Date(),
        },
      ]);
      activityRepo.findOne.mockResolvedValue(null);
      activityRepo.create.mockReturnValue({ id: 'act-1' });
      activityRepo.save.mockResolvedValue({ id: 'act-1' });

      const result = await service.syncWithRetry(sync);

      expect(result.success).toBe(true);
      expect(result.eventsSynced).toBe(1);
      expect(result.attempts).toBe(1);
      expect(sync.status).toBe('connected');
      expect(sync.consecutiveFailures).toBe(0);
    });

    it('should retry and succeed on second attempt', async () => {
      const sync = makeSync();
      calendarSyncRepo.save.mockResolvedValue(sync);

      let callCount = 0;
      googleCalendarService.listEvents.mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error('Temporary failure');
        return Promise.resolve([]);
      });

      // Override sleep to avoid waiting
      (service as any).sleep = jest.fn().mockResolvedValue(undefined);

      const result = await service.syncWithRetry(sync);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('should fail after MAX_RETRIES exhausted', async () => {
      const sync = makeSync();
      calendarSyncRepo.save.mockResolvedValue(sync);
      googleCalendarService.listEvents.mockRejectedValue(new Error('Persistent failure'));
      (service as any).sleep = jest.fn().mockResolvedValue(undefined);

      const result = await service.syncWithRetry(sync);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(result.error).toBe('Persistent failure');
      expect(sync.status).toBe('error');
      expect(sync.consecutiveFailures).toBe(1);
    });

    it('should not create duplicate activity entries', async () => {
      const sync = makeSync();
      calendarSyncRepo.save.mockResolvedValue(sync);
      googleCalendarService.listEvents.mockResolvedValue([
        {
          eventId: 'evt-1',
          summary: 'Existing Meeting',
          start: new Date(),
          end: new Date(),
          attendees: [],
          status: 'confirmed',
          updated: new Date(),
        },
      ]);
      const existingActivity = { id: 'act-existing' };
      activityRepo.findOne.mockResolvedValue(existingActivity);

      const result = await service.syncWithRetry(sync);

      expect(result.success).toBe(true);
      expect(activityRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('executeSync', () => {
    it('should sync all connected providers for a user', async () => {
      const googleSync = {
        id: 's1', tenantId: 't1', userId: 'u1', provider: 'google_calendar',
        status: 'connected', accessToken: 'tok', refreshToken: 'ref',
        tokenExpiresAt: new Date(Date.now() + 3600000),
        lastSyncAt: new Date(), consecutiveFailures: 0, lastError: null,
        calendarId: null, createdAt: new Date(), updatedAt: new Date(),
      };
      const msSync = {
        id: 's2', tenantId: 't1', userId: 'u1', provider: 'microsoft_calendar',
        status: 'connected', accessToken: 'tok2', refreshToken: 'ref2',
        tokenExpiresAt: new Date(Date.now() + 3600000),
        lastSyncAt: new Date(), consecutiveFailures: 0, lastError: null,
        calendarId: null, createdAt: new Date(), updatedAt: new Date(),
      };

      calendarSyncRepo.find.mockResolvedValue([googleSync, msSync]);
      calendarSyncRepo.save.mockImplementation((s: any) => Promise.resolve(s));
      googleCalendarService.listEvents.mockResolvedValue([]);
      microsoftCalendarService.listEvents.mockResolvedValue([]);

      const results = await service.executeSync('t1', 'u1');

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should filter by provider when specified', async () => {
      const googleSync = {
        id: 's1', tenantId: 't1', userId: 'u1', provider: 'google_calendar',
        status: 'connected', accessToken: 'tok', refreshToken: 'ref',
        tokenExpiresAt: new Date(Date.now() + 3600000),
        lastSyncAt: new Date(), consecutiveFailures: 0, lastError: null,
        calendarId: null, createdAt: new Date(), updatedAt: new Date(),
      };

      calendarSyncRepo.find.mockResolvedValue([googleSync]);
      calendarSyncRepo.save.mockImplementation((s: any) => Promise.resolve(s));
      googleCalendarService.listEvents.mockResolvedValue([]);

      const results = await service.executeSync('t1', 'u1', 'google_calendar');

      expect(results).toHaveLength(1);
      expect(calendarSyncRepo.find).toHaveBeenCalledWith({
        where: { tenantId: 't1', userId: 'u1', provider: 'google_calendar', status: 'connected' },
      });
    });

    it('should skip disconnected syncs', async () => {
      const disconnected = {
        id: 's1', tenantId: 't1', userId: 'u1', provider: 'google_calendar',
        status: 'disconnected',
      };
      calendarSyncRepo.find.mockResolvedValue([disconnected]);

      const results = await service.executeSync('t1', 'u1');
      expect(results).toHaveLength(0);
    });
  });

  describe('getCalendarEvents', () => {
    it('should aggregate events from all connected providers sorted by start time', async () => {
      const now = new Date();
      const googleSync = {
        id: 's1', provider: 'google_calendar', status: 'connected',
        accessToken: 'tok', refreshToken: 'ref',
        tokenExpiresAt: new Date(Date.now() + 3600000),
        calendarId: null,
      };
      const msSync = {
        id: 's2', provider: 'microsoft_calendar', status: 'connected',
        accessToken: 'tok2', refreshToken: 'ref2',
        tokenExpiresAt: new Date(Date.now() + 3600000),
        calendarId: null,
      };

      calendarSyncRepo.find.mockResolvedValue([googleSync, msSync]);
      calendarSyncRepo.save.mockImplementation((s: any) => Promise.resolve(s));

      const laterDate = new Date(now.getTime() + 3600000);
      googleCalendarService.listEvents.mockResolvedValue([
        { eventId: 'g1', summary: 'Google Event', start: laterDate, end: new Date(laterDate.getTime() + 1800000), attendees: [], status: 'confirmed', updated: now },
      ]);
      microsoftCalendarService.listEvents.mockResolvedValue([
        { eventId: 'm1', subject: 'MS Event', start: now, end: new Date(now.getTime() + 1800000), attendees: [], lastModifiedDateTime: now },
      ]);

      const events = await service.getCalendarEvents('t1', 'u1');

      expect(events).toHaveLength(2);
      // MS event (earlier) should come first
      expect(events[0].provider).toBe('microsoft_calendar');
      expect(events[1].provider).toBe('google_calendar');
    });
  });

  describe('ensureValidToken', () => {
    it('should return existing token if not expired', async () => {
      const sync = {
        accessToken: 'valid-tok',
        refreshToken: 'ref-tok',
        tokenExpiresAt: new Date(Date.now() + 3600000),
        provider: 'google_calendar',
      } as CalendarSync;

      const token = await service.ensureValidToken(sync);
      expect(token).toBe('valid-tok');
      expect(googleCalendarService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('should refresh Google token if expired', async () => {
      const sync = {
        accessToken: 'expired-tok',
        refreshToken: 'ref-tok',
        tokenExpiresAt: new Date(Date.now() - 1000),
        provider: 'google_calendar',
      } as CalendarSync;

      googleCalendarService.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-tok',
        refreshToken: 'ref-tok',
        expiresAt: new Date(Date.now() + 3600000),
      });
      calendarSyncRepo.save.mockResolvedValue(sync);

      const token = await service.ensureValidToken(sync);
      expect(token).toBe('new-tok');
      expect(googleCalendarService.refreshAccessToken).toHaveBeenCalledWith('ref-tok');
    });

    it('should refresh Microsoft token if expired', async () => {
      const sync = {
        accessToken: 'expired-tok',
        refreshToken: 'ref-tok',
        tokenExpiresAt: new Date(Date.now() - 1000),
        provider: 'microsoft_calendar',
      } as CalendarSync;

      microsoftCalendarService.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-ms-tok',
        refreshToken: 'ref-tok',
        expiresAt: new Date(Date.now() + 3600000),
      });
      calendarSyncRepo.save.mockResolvedValue(sync);

      const token = await service.ensureValidToken(sync);
      expect(token).toBe('new-ms-tok');
      expect(microsoftCalendarService.refreshAccessToken).toHaveBeenCalledWith('ref-tok');
    });

    it('should throw if no tokens available', async () => {
      const sync = {
        accessToken: null,
        refreshToken: null,
        provider: 'google_calendar',
      } as CalendarSync;

      await expect(service.ensureValidToken(sync)).rejects.toThrow('No tokens available');
    });
  });
});
