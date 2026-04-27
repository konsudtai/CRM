import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarSync, CalendarProvider } from '../../entities/calendar-sync.entity';
import { Activity } from '../../entities/activity.entity';
import { GoogleCalendarService, GoogleCalendarEvent } from './google-calendar.service';
import { MicrosoftCalendarService, MicrosoftCalendarEvent } from './microsoft-calendar.service';

export interface CalendarSyncResult {
  success: boolean;
  eventsSynced: number;
  attempts: number;
  error?: string;
}

export interface CalendarEventDto {
  eventId: string;
  provider: CalendarProvider;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees: string[];
}

/**
 * Orchestrates bidirectional calendar sync for Google Calendar and Microsoft 365 Calendar.
 * Creates Activity entries (entityType: 'meeting') for synced calendar events.
 * Retries up to 3 times with exponential backoff on failure.
 */
@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);
  readonly MAX_RETRIES = 3;
  readonly BASE_DELAY_MS = 1000;

  constructor(
    @InjectRepository(CalendarSync)
    private readonly calendarSyncRepo: Repository<CalendarSync>,
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly microsoftCalendarService: MicrosoftCalendarService,
  ) {}

  /** Get or create a CalendarSync record for a user+provider */
  async getOrCreateSync(
    tenantId: string,
    userId: string,
    provider: CalendarProvider,
  ): Promise<CalendarSync> {
    let sync = await this.calendarSyncRepo.findOne({
      where: { tenantId, userId, provider },
    });
    if (!sync) {
      sync = this.calendarSyncRepo.create({
        tenantId,
        userId,
        provider,
        status: 'disconnected',
      });
      sync = await this.calendarSyncRepo.save(sync);
    }
    return sync;
  }

  /** Store OAuth tokens after successful callback */
  async storeTokens(
    syncId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<CalendarSync> {
    const sync = await this.calendarSyncRepo.findOne({ where: { id: syncId } });
    if (!sync) throw new NotFoundException('Calendar sync record not found');

    sync.accessToken = accessToken;
    sync.refreshToken = refreshToken;
    sync.tokenExpiresAt = expiresAt;
    sync.status = 'connected';
    sync.consecutiveFailures = 0;
    sync.lastError = null;
    return this.calendarSyncRepo.save(sync);
  }

  /** Get sync status for a user */
  async getSyncStatus(tenantId: string, userId: string): Promise<CalendarSync[]> {
    return this.calendarSyncRepo.find({
      where: { tenantId, userId },
      select: [
        'id', 'provider', 'status', 'lastSyncAt', 'lastError',
        'consecutiveFailures', 'calendarId', 'createdAt',
      ],
    });
  }

  /** Get calendar events from all connected providers for a user */
  async getCalendarEvents(
    tenantId: string,
    userId: string,
    sinceDate?: Date,
  ): Promise<CalendarEventDto[]> {
    const syncs = await this.calendarSyncRepo.find({
      where: { tenantId, userId },
    });

    const connectedSyncs = syncs.filter(
      (s) => s.status === 'connected' || s.status === 'syncing',
    );

    const events: CalendarEventDto[] = [];

    for (const sync of connectedSyncs) {
      try {
        const accessToken = await this.ensureValidToken(sync);
        const providerEvents = await this.fetchEvents(sync, accessToken, sinceDate);
        events.push(...providerEvents);
      } catch (err: any) {
        this.logger.warn(
          `Failed to fetch calendar events for ${sync.provider} (user ${sync.userId}): ${err.message}`,
        );
      }
    }

    return events.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  /**
   * Execute sync for a specific user/provider with retry logic.
   * Up to 3 attempts with exponential backoff (1s, 2s, 4s).
   */
  async executeSync(
    tenantId: string,
    userId: string,
    provider?: CalendarProvider,
  ): Promise<CalendarSyncResult[]> {
    const syncs = provider
      ? await this.calendarSyncRepo.find({ where: { tenantId, userId, provider, status: 'connected' } })
      : await this.calendarSyncRepo.find({ where: { tenantId, userId } });

    const connectedSyncs = syncs.filter(
      (s) => s.status === 'connected' || s.status === 'error',
    );
    const results: CalendarSyncResult[] = [];

    for (const sync of connectedSyncs) {
      const result = await this.syncWithRetry(sync);
      results.push(result);
    }

    return results;
  }

  /** Sync with retry: up to MAX_RETRIES attempts with exponential backoff */
  async syncWithRetry(sync: CalendarSync): Promise<CalendarSyncResult> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        sync.status = 'syncing';
        await this.calendarSyncRepo.save(sync);

        const result = await this.performSync(sync);

        sync.status = 'connected';
        sync.lastSyncAt = new Date();
        sync.consecutiveFailures = 0;
        sync.lastError = null;
        await this.calendarSyncRepo.save(sync);

        return { ...result, attempts: attempt + 1 };
      } catch (err: any) {
        lastError = err.message || 'Unknown sync error';
        this.logger.warn(
          `Calendar sync attempt ${attempt + 1}/${this.MAX_RETRIES} failed for ${sync.provider} (user ${sync.userId}): ${lastError}`,
        );

        if (attempt < this.MAX_RETRIES - 1) {
          const delay = this.calculateBackoffDelay(attempt, this.BASE_DELAY_MS);
          await this.sleep(delay);
        }
      }
    }

    sync.status = 'error';
    sync.consecutiveFailures += 1;
    sync.lastError = lastError || 'Sync failed after max retries';
    await this.calendarSyncRepo.save(sync);

    return {
      success: false,
      eventsSynced: 0,
      attempts: this.MAX_RETRIES,
      error: lastError,
    };
  }

  /** Calculate exponential backoff delay: base_delay * 2^attempt */
  calculateBackoffDelay(attempt: number, baseDelay: number): number {
    return baseDelay * Math.pow(2, attempt);
  }

  private async performSync(
    sync: CalendarSync,
  ): Promise<Omit<CalendarSyncResult, 'attempts'>> {
    const accessToken = await this.ensureValidToken(sync);
    const sinceDate = sync.lastSyncAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const events = await this.fetchEvents(sync, accessToken, sinceDate);

    for (const event of events) {
      await this.createMeetingActivity(sync.tenantId, sync.userId, event);
    }

    return { success: true, eventsSynced: events.length };
  }

  private async fetchEvents(
    sync: CalendarSync,
    accessToken: string,
    sinceDate?: Date,
  ): Promise<CalendarEventDto[]> {
    if (sync.provider === 'google_calendar') {
      const events = await this.googleCalendarService.listEvents(
        accessToken, sinceDate, sync.calendarId || 'primary',
      );
      return events.map((e) => this.mapGoogleEvent(e));
    } else {
      const events = await this.microsoftCalendarService.listEvents(accessToken, sinceDate);
      return events.map((e) => this.mapMicrosoftEvent(e));
    }
  }

  async ensureValidToken(sync: CalendarSync): Promise<string> {
    if (!sync.accessToken || !sync.refreshToken) {
      throw new Error('No tokens available — reconnect required');
    }

    if (sync.tokenExpiresAt && sync.tokenExpiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
      return sync.accessToken;
    }

    if (sync.provider === 'google_calendar') {
      const tokens = await this.googleCalendarService.refreshAccessToken(sync.refreshToken);
      sync.accessToken = tokens.accessToken;
      sync.refreshToken = tokens.refreshToken;
      sync.tokenExpiresAt = tokens.expiresAt;
    } else {
      const tokens = await this.microsoftCalendarService.refreshAccessToken(sync.refreshToken);
      sync.accessToken = tokens.accessToken;
      sync.refreshToken = tokens.refreshToken;
      sync.tokenExpiresAt = tokens.expiresAt;
    }

    await this.calendarSyncRepo.save(sync);
    return sync.accessToken;
  }

  private async createMeetingActivity(
    tenantId: string,
    userId: string,
    event: CalendarEventDto,
  ): Promise<Activity> {
    const existing = await this.activityRepo.findOne({
      where: {
        tenantId,
        entityType: 'meeting',
        metadata: { eventId: event.eventId, provider: event.provider } as any,
      },
    });

    if (existing) return existing;

    const activity = this.activityRepo.create({
      tenantId,
      entityType: 'meeting',
      entityId: userId,
      summary: `Calendar: ${event.summary || '(no title)'}`,
      userId,
      timestamp: event.start,
      metadata: {
        provider: event.provider,
        eventId: event.eventId,
        summary: event.summary,
        description: event.description,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        location: event.location,
        attendees: event.attendees,
      },
    });

    return this.activityRepo.save(activity);
  }

  private mapGoogleEvent(event: GoogleCalendarEvent): CalendarEventDto {
    return {
      eventId: event.eventId,
      provider: 'google_calendar',
      summary: event.summary,
      description: event.description,
      start: event.start,
      end: event.end,
      location: event.location,
      attendees: event.attendees,
    };
  }

  private mapMicrosoftEvent(event: MicrosoftCalendarEvent): CalendarEventDto {
    return {
      eventId: event.eventId,
      provider: 'microsoft_calendar',
      summary: event.subject,
      description: event.bodyPreview,
      start: event.start,
      end: event.end,
      location: event.location,
      attendees: event.attendees,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
