import { Injectable, Logger } from '@nestjs/common';

export interface GmailTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface GmailMessage {
  messageId: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  snippet: string;
  date: Date;
  labelIds: string[];
}

/**
 * Wraps the Gmail API (googleapis) for OAuth2 auth, message listing, and sending.
 * In production, uses the `googleapis` package. Here we define the interface
 * and implement with fetch calls to Google's REST endpoints.
 */
@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);
  private readonly GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
  private readonly GMAIL_API_URL = 'https://gmail.googleapis.com/gmail/v1';

  private get clientId(): string {
    return process.env.GOOGLE_CLIENT_ID || '';
  }

  private get clientSecret(): string {
    return process.env.GOOGLE_CLIENT_SECRET || '';
  }

  /** Build the OAuth2 authorization URL for Gmail */
  getAuthUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /** Exchange authorization code for tokens */
  async exchangeCode(code: string, redirectUri: string): Promise<GmailTokens> {
    const response = await fetch(this.GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gmail token exchange failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /** Refresh an expired access token */
  async refreshAccessToken(refreshToken: string): Promise<GmailTokens> {
    const response = await fetch(this.GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gmail token refresh failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as any;
    return {
      accessToken: data.access_token,
      refreshToken: refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /** List messages since a given date */
  async listMessages(accessToken: string, sinceDate?: Date): Promise<GmailMessage[]> {
    let query = '';
    if (sinceDate) {
      const epoch = Math.floor(sinceDate.getTime() / 1000);
      query = `after:${epoch}`;
    }

    const params = new URLSearchParams({ maxResults: '50' });
    if (query) params.set('q', query);

    const listResponse = await fetch(
      `${this.GMAIL_API_URL}/users/me/messages?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!listResponse.ok) {
      throw new Error(`Gmail list messages failed: ${listResponse.status}`);
    }

    const listData = (await listResponse.json()) as any;
    const messageIds: string[] = (listData.messages || []).map((m: any) => m.id);

    const messages: GmailMessage[] = [];
    for (const msgId of messageIds) {
      try {
        const msg = await this.getMessage(accessToken, msgId);
        if (msg) messages.push(msg);
      } catch (err) {
        this.logger.warn(`Failed to fetch Gmail message ${msgId}: ${err}`);
      }
    }

    return messages;
  }

  /** Get a single message by ID */
  async getMessage(accessToken: string, messageId: string): Promise<GmailMessage | null> {
    const response = await fetch(
      `${this.GMAIL_API_URL}/users/me/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as any;
    const headers = data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      messageId: data.id,
      threadId: data.threadId,
      from: getHeader('From'),
      to: getHeader('To').split(',').map((s: string) => s.trim()).filter(Boolean),
      subject: getHeader('Subject'),
      snippet: data.snippet || '',
      date: new Date(parseInt(data.internalDate, 10)),
      labelIds: data.labelIds || [],
    };
  }

  /** Send an email via Gmail API */
  async sendMessage(
    accessToken: string,
    to: string,
    subject: string,
    body: string,
  ): Promise<string> {
    const raw = this.buildRawEmail(to, subject, body);
    const response = await fetch(
      `${this.GMAIL_API_URL}/users/me/messages/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      },
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gmail send failed: ${response.status} ${errBody}`);
    }

    const data = (await response.json()) as any;
    return data.id;
  }

  private buildRawEmail(to: string, subject: string, body: string): string {
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n');

    return Buffer.from(email).toString('base64url');
  }
}
