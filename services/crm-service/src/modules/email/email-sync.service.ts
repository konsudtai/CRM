import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailSync } from '../../entities/email-sync.entity';
import { Contact } from '../../entities/contact.entity';
import { Activity } from '../../entities/activity.entity';
import { GmailService, GmailMessage } from './gmail.service';
import { OutlookService, OutlookMessage } from './outlook.service';

export interface SyncResult {
  success: boolean;
  emailsSynced: number;
  emailsLinked: number;
  attempts: number;
  error?: string;
}

/**
 * Orchestrates bidirectional email sync for Gmail and Outlook.
 * Links emails to contacts by matching email addresses.
 * Creates timeline entries (entityType: 'email') for synced emails.
 * Retries up to 3 times with exponential backoff on failure.
 */
@Injectable()
export class EmailSyncService {
  private readonly logger = new Logger(EmailSyncService.name);
  readonly MAX_RETRIES = 3;
  readonly BASE_DELAY_MS = 1000;

  constructor(
    @InjectRepository(EmailSync)
    private readonly emailSyncRepo: Repository<EmailSync>,
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    private readonly gmailService: GmailService,
    private readonly outlookService: OutlookService,
  ) {}

  /** Get or create an EmailSync record for a user+provider */
  async getOrCreateSync(
    tenantId: string,
    userId: string,
    provider: 'gmail' | 'outlook',
  ): Promise<EmailSync> {
    let sync = await this.emailSyncRepo.findOne({
      where: { tenantId, userId, provider },
    });
    if (!sync) {
      sync = this.emailSyncRepo.create({
        tenantId,
        userId,
        provider,
        status: 'disconnected',
      });
      sync = await this.emailSyncRepo.save(sync);
    }
    return sync;
  }

  /** Store OAuth tokens after successful callback */
  async storeTokens(
    syncId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<EmailSync> {
    const sync = await this.emailSyncRepo.findOne({ where: { id: syncId } });
    if (!sync) throw new NotFoundException('Email sync record not found');

    sync.accessToken = accessToken;
    sync.refreshToken = refreshToken;
    sync.tokenExpiresAt = expiresAt;
    sync.status = 'connected';
    sync.consecutiveFailures = 0;
    sync.lastError = null;
    return this.emailSyncRepo.save(sync);
  }

  /** Get sync status for a user */
  async getSyncStatus(
    tenantId: string,
    userId: string,
  ): Promise<EmailSync[]> {
    return this.emailSyncRepo.find({
      where: { tenantId, userId },
      select: ['id', 'provider', 'status', 'lastSyncAt', 'lastError', 'consecutiveFailures', 'createdAt'],
    });
  }

  /**
   * Execute sync for a specific user+provider with retry logic.
   * Up to 3 attempts with exponential backoff (1s, 2s, 4s).
   * Returns a SyncResult indicating success/failure.
   */
  async executeSync(tenantId: string, userId: string, provider?: 'gmail' | 'outlook'): Promise<SyncResult[]> {
    const syncs = provider
      ? await this.emailSyncRepo.find({ where: { tenantId, userId, provider, status: 'connected' } })
      : await this.emailSyncRepo.find({ where: { tenantId, userId } });

    const connectedSyncs = syncs.filter((s) => s.status === 'connected' || s.status === 'error');
    const results: SyncResult[] = [];

    for (const sync of connectedSyncs) {
      const result = await this.syncWithRetry(sync);
      results.push(result);
    }

    return results;
  }

  /**
   * Sync with retry: up to MAX_RETRIES attempts with exponential backoff.
   */
  async syncWithRetry(sync: EmailSync): Promise<SyncResult> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        sync.status = 'syncing';
        await this.emailSyncRepo.save(sync);

        const result = await this.performSync(sync);

        // Success — reset failure counter
        sync.status = 'connected';
        sync.lastSyncAt = new Date();
        sync.consecutiveFailures = 0;
        sync.lastError = null;
        await this.emailSyncRepo.save(sync);

        return { ...result, attempts: attempt + 1 };
      } catch (err: any) {
        lastError = err.message || 'Unknown sync error';
        this.logger.warn(
          `Email sync attempt ${attempt + 1}/${this.MAX_RETRIES} failed for ${sync.provider} (user ${sync.userId}): ${lastError}`,
        );

        if (attempt < this.MAX_RETRIES - 1) {
          const delay = this.calculateBackoffDelay(attempt, this.BASE_DELAY_MS);
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted — mark as error, notify user
    sync.status = 'error';
    sync.consecutiveFailures += 1;
    sync.lastError = lastError || 'Sync failed after max retries';
    await this.emailSyncRepo.save(sync);

    return {
      success: false,
      emailsSynced: 0,
      emailsLinked: 0,
      attempts: this.MAX_RETRIES,
      error: lastError,
    };
  }

  /** Calculate exponential backoff delay: base_delay * 2^attempt */
  calculateBackoffDelay(attempt: number, baseDelay: number): number {
    return baseDelay * Math.pow(2, attempt);
  }

  /**
   * Perform the actual sync: fetch messages, match to contacts, create timeline entries.
   */
  private async performSync(sync: EmailSync): Promise<Omit<SyncResult, 'attempts'>> {
    // Ensure token is valid, refresh if needed
    const accessToken = await this.ensureValidToken(sync);

    // Fetch messages since last sync
    const sinceDate = sync.lastSyncAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // default: last 7 days

    let emailsSynced = 0;
    let emailsLinked = 0;

    if (sync.provider === 'gmail') {
      const messages = await this.gmailService.listMessages(accessToken, sinceDate);
      emailsSynced = messages.length;
      emailsLinked = await this.linkGmailMessages(sync.tenantId, sync.userId, messages);
    } else {
      const messages = await this.outlookService.listMessages(accessToken, sinceDate);
      emailsSynced = messages.length;
      emailsLinked = await this.linkOutlookMessages(sync.tenantId, sync.userId, messages);
    }

    return { success: true, emailsSynced, emailsLinked };
  }

  /** Ensure the access token is valid; refresh if expired */
  private async ensureValidToken(sync: EmailSync): Promise<string> {
    if (!sync.accessToken || !sync.refreshToken) {
      throw new Error('No tokens available — reconnect required');
    }

    // If token is still valid (with 5-minute buffer), use it
    if (sync.tokenExpiresAt && sync.tokenExpiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
      return sync.accessToken;
    }

    // Refresh the token
    if (sync.provider === 'gmail') {
      const tokens = await this.gmailService.refreshAccessToken(sync.refreshToken);
      sync.accessToken = tokens.accessToken;
      sync.refreshToken = tokens.refreshToken;
      sync.tokenExpiresAt = tokens.expiresAt;
    } else {
      const tokens = await this.outlookService.refreshAccessToken(sync.refreshToken);
      sync.accessToken = tokens.accessToken;
      sync.refreshToken = tokens.refreshToken;
      sync.tokenExpiresAt = tokens.expiresAt;
    }

    await this.emailSyncRepo.save(sync);
    return sync.accessToken;
  }

  /** Link Gmail messages to contacts and create timeline entries */
  private async linkGmailMessages(
    tenantId: string,
    userId: string,
    messages: GmailMessage[],
  ): Promise<number> {
    let linked = 0;

    for (const msg of messages) {
      const emailAddresses = this.extractEmailAddresses([msg.from, ...msg.to]);
      const contacts = await this.findContactsByEmails(tenantId, emailAddresses);

      for (const contact of contacts) {
        await this.createEmailActivity(tenantId, userId, contact.id, {
          provider: 'gmail',
          messageId: msg.messageId,
          subject: msg.subject,
          snippet: msg.snippet,
          from: msg.from,
          to: msg.to,
          date: msg.date,
        });
        linked++;
      }
    }

    return linked;
  }

  /** Link Outlook messages to contacts and create timeline entries */
  private async linkOutlookMessages(
    tenantId: string,
    userId: string,
    messages: OutlookMessage[],
  ): Promise<number> {
    let linked = 0;

    for (const msg of messages) {
      const emailAddresses = this.extractEmailAddresses([msg.from, ...msg.toRecipients]);
      const contacts = await this.findContactsByEmails(tenantId, emailAddresses);

      for (const contact of contacts) {
        await this.createEmailActivity(tenantId, userId, contact.id, {
          provider: 'outlook',
          messageId: msg.messageId,
          subject: msg.subject,
          snippet: msg.bodyPreview,
          from: msg.from,
          to: msg.toRecipients,
          date: msg.receivedDateTime,
        });
        linked++;
      }
    }

    return linked;
  }

  /** Find contacts matching any of the given email addresses */
  async findContactsByEmails(tenantId: string, emails: string[]): Promise<Contact[]> {
    if (emails.length === 0) return [];

    const normalizedEmails = emails.map((e) => e.toLowerCase().trim());

    return this.contactRepo
      .createQueryBuilder('contact')
      .where('contact.tenant_id = :tenantId', { tenantId })
      .andWhere('LOWER(contact.email) IN (:...emails)', { emails: normalizedEmails })
      .getMany();
  }

  /** Create an activity timeline entry for a synced email */
  private async createEmailActivity(
    tenantId: string,
    userId: string,
    contactId: string,
    metadata: {
      provider: string;
      messageId: string;
      subject: string;
      snippet: string;
      from: string;
      to: string[];
      date: Date;
    },
  ): Promise<Activity> {
    // Check if this email activity already exists (avoid duplicates)
    const existing = await this.activityRepo.findOne({
      where: {
        tenantId,
        entityType: 'email',
        entityId: contactId,
        metadata: { messageId: metadata.messageId, provider: metadata.provider } as any,
      },
    });

    if (existing) return existing;

    const activity = this.activityRepo.create({
      tenantId,
      entityType: 'email',
      entityId: contactId,
      summary: `Email: ${metadata.subject || '(no subject)'}`,
      userId,
      timestamp: metadata.date,
      metadata,
    });

    return this.activityRepo.save(activity);
  }

  /** Extract clean email addresses from strings like "Name <email@example.com>" */
  extractEmailAddresses(rawAddresses: string[]): string[] {
    const emails: string[] = [];
    for (const raw of rawAddresses) {
      if (!raw) continue;
      const match = raw.match(/<([^>]+)>/);
      if (match) {
        emails.push(match[1].toLowerCase().trim());
      } else if (raw.includes('@')) {
        emails.push(raw.toLowerCase().trim());
      }
    }
    return [...new Set(emails)];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
