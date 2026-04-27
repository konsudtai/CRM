import { Injectable, Logger } from '@nestjs/common';

export interface MicrosoftCalendarTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface MicrosoftCalendarEvent {
  eventId: string;
  subject: string;
  bodyPreview?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees: string[];
  webLink?: string;
  lastModifiedDateTime: Date;
}

/**
 * Wraps the Microsoft Graph API calendar endpoints for OAuth2 auth,
 * event listing, and event creation/update.
 */
@Injectable()
export class MicrosoftCalendarService {
  private readonly logger = new Logger(MicrosoftCalendarService.name);
  private readonly MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  private readonly GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';

  private get clientId(): string {
    return process.env.MICROSOFT_CLIENT_ID || '';
  }

  private get clientSecret(): string {
    return process.env.MICROSOFT_CLIENT_SECRET || '';
  }

  /** Build the OAuth2 authorization URL for Microsoft 365 Calendar */
  getAuthUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
      response_mode: 'query',
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /** Exchange authorization code for tokens */
  async exchangeCode(code: string, redirectUri: string): Promise<MicrosoftCalendarTokens> {
    const response = await fetch(this.MS_TOKEN_URL, {
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
      throw new Error(`Microsoft Calendar token exchange failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /** Refresh an expired access token */
  async refreshAccessToken(refreshToken: string): Promise<MicrosoftCalendarTokens> {
    const response = await fetch(this.MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Microsoft Calendar token refresh failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /** List calendar events since a given date */
  async listEvents(accessToken: string, sinceDate?: Date): Promise<MicrosoftCalendarEvent[]> {
    let url = `${this.GRAPH_API_URL}/me/events?$top=100&$orderby=start/dateTime&$select=id,subject,bodyPreview,start,end,location,attendees,webLink,lastModifiedDateTime`;

    if (sinceDate) {
      url += `&$filter=start/dateTime ge '${sinceDate.toISOString()}'`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Microsoft Calendar list events failed: ${response.status}`);
    }

    const data = (await response.json()) as any;
    return (data.value || []).map((item: any) => this.mapEvent(item));
  }

  /** Create a calendar event */
  async createEvent(
    accessToken: string,
    event: { subject: string; body?: string; start: Date; end: Date; location?: string },
  ): Promise<MicrosoftCalendarEvent> {
    const response = await fetch(`${this.GRAPH_API_URL}/me/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: event.subject,
        body: event.body ? { contentType: 'Text', content: event.body } : undefined,
        start: { dateTime: event.start.toISOString(), timeZone: 'UTC' },
        end: { dateTime: event.end.toISOString(), timeZone: 'UTC' },
        location: event.location ? { displayName: event.location } : undefined,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Microsoft Calendar create event failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as any;
    return this.mapEvent(data);
  }

  /** Update a calendar event */
  async updateEvent(
    accessToken: string,
    eventId: string,
    event: { subject?: string; body?: string; start?: Date; end?: Date; location?: string },
  ): Promise<MicrosoftCalendarEvent> {
    const payload: any = {};
    if (event.subject) payload.subject = event.subject;
    if (event.body !== undefined) payload.body = { contentType: 'Text', content: event.body };
    if (event.start) payload.start = { dateTime: event.start.toISOString(), timeZone: 'UTC' };
    if (event.end) payload.end = { dateTime: event.end.toISOString(), timeZone: 'UTC' };
    if (event.location !== undefined) payload.location = { displayName: event.location };

    const response = await fetch(`${this.GRAPH_API_URL}/me/events/${eventId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Microsoft Calendar update event failed: ${response.status} ${errBody}`);
    }

    const data = (await response.json()) as any;
    return this.mapEvent(data);
  }

  private mapEvent(item: any): MicrosoftCalendarEvent {
    return {
      eventId: item.id,
      subject: item.subject || '',
      bodyPreview: item.bodyPreview,
      start: new Date(item.start?.dateTime),
      end: new Date(item.end?.dateTime),
      location: item.location?.displayName,
      attendees: (item.attendees || []).map((a: any) => a.emailAddress?.address || ''),
      webLink: item.webLink,
      lastModifiedDateTime: new Date(item.lastModifiedDateTime),
    };
  }
}
