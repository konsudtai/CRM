import { Injectable, Logger } from '@nestjs/common';

export interface GoogleCalendarTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface GoogleCalendarEvent {
  eventId: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees: string[];
  htmlLink?: string;
  status: string;
  updated: Date;
}

/**
 * Wraps the Google Calendar API for OAuth2 auth, event listing, and event creation/update.
 * Uses fetch calls to Google's REST endpoints.
 */
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
  private readonly CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3';

  private get clientId(): string {
    return process.env.GOOGLE_CLIENT_ID || '';
  }

  private get clientSecret(): string {
    return process.env.GOOGLE_CLIENT_SECRET || '';
  }

  /** Build the OAuth2 authorization URL for Google Calendar */
  getAuthUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar',
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /** Exchange authorization code for tokens */
  async exchangeCode(code: string, redirectUri: string): Promise<GoogleCalendarTokens> {
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
      throw new Error(`Google Calendar token exchange failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /** Refresh an expired access token */
  async refreshAccessToken(refreshToken: string): Promise<GoogleCalendarTokens> {
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
      throw new Error(`Google Calendar token refresh failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as any;
    return {
      accessToken: data.access_token,
      refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /** List calendar events since a given date */
  async listEvents(
    accessToken: string,
    sinceDate?: Date,
    calendarId: string = 'primary',
  ): Promise<GoogleCalendarEvent[]> {
    const params = new URLSearchParams({
      maxResults: '100',
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    if (sinceDate) {
      params.set('timeMin', sinceDate.toISOString());
    }

    const response = await fetch(
      `${this.CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      throw new Error(`Google Calendar list events failed: ${response.status}`);
    }

    const data = (await response.json()) as any;
    return (data.items || []).map((item: any) => this.mapEvent(item));
  }

  /** Create a calendar event */
  async createEvent(
    accessToken: string,
    event: { summary: string; description?: string; start: Date; end: Date; location?: string },
    calendarId: string = 'primary',
  ): Promise<GoogleCalendarEvent> {
    const response = await fetch(
      `${this.CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          location: event.location,
          start: { dateTime: event.start.toISOString() },
          end: { dateTime: event.end.toISOString() },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google Calendar create event failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as any;
    return this.mapEvent(data);
  }

  /** Update a calendar event */
  async updateEvent(
    accessToken: string,
    eventId: string,
    event: { summary?: string; description?: string; start?: Date; end?: Date; location?: string },
    calendarId: string = 'primary',
  ): Promise<GoogleCalendarEvent> {
    const body: any = {};
    if (event.summary) body.summary = event.summary;
    if (event.description !== undefined) body.description = event.description;
    if (event.location !== undefined) body.location = event.location;
    if (event.start) body.start = { dateTime: event.start.toISOString() };
    if (event.end) body.end = { dateTime: event.end.toISOString() };

    const response = await fetch(
      `${this.CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Google Calendar update event failed: ${response.status} ${errBody}`);
    }

    const data = (await response.json()) as any;
    return this.mapEvent(data);
  }

  private mapEvent(item: any): GoogleCalendarEvent {
    return {
      eventId: item.id,
      summary: item.summary || '',
      description: item.description,
      start: new Date(item.start?.dateTime || item.start?.date),
      end: new Date(item.end?.dateTime || item.end?.date),
      location: item.location,
      attendees: (item.attendees || []).map((a: any) => a.email),
      htmlLink: item.htmlLink,
      status: item.status || 'confirmed',
      updated: new Date(item.updated),
    };
  }
}
